import { createHash, randomUUID } from 'node:crypto';
import {
  MAX_BID_AMOUNT,
  type AuctionState,
  type PlaceBidRequest,
  type Problem,
  type User,
} from '@the-block/shared';
import type { Logger } from 'pino';
import type { AuctionClock } from '../clock.js';
import type { Db } from '../db/connection.js';
import {
  evaluateBid,
  evaluateBuyNow,
  type BidRejectionCode,
  type BuyNowRejectionCode,
} from '../domain/bid-rules.js';
import type { AuctionEvent, AuctionEvents } from '../events/auction-events.js';
import { formatCad } from '../money.js';
import { problem, problemError } from '../problems.js';
import type { BidRepository } from '../repositories/bid-repository.js';
import type { IdempotencyRepository } from '../repositories/idempotency-repository.js';
import type { VehicleRecord, VehicleRepository } from '../repositories/vehicle-repository.js';
import { toAuctionState } from './views.js';

interface AuctionCommand {
  user: User;
  vehicleId: string;
  idempotencyKey: string;
  log: Logger;
}

export interface PlaceBidCommand extends AuctionCommand {
  request: PlaceBidRequest;
}

export type BuyNowCommand = AuctionCommand;

/** An HTTP response for a bid or Buy Now: stored verbatim against the idempotency key so replays match exactly. */
export interface BidResult {
  status: number;
  body: AuctionState | Problem;
  replayed: boolean;
}

/** What an evaluation decided, plus the event to publish once it has been committed. */
interface Outcome {
  status: number;
  body: AuctionState | Problem;
  event?: AuctionEvent;
}

const PLACE_BID = 'placeBid';
const BUY_NOW = 'buyNow';

/**
 * Accepts or rejects bids and Buy Now purchases (design §6.3, §8). Each runs in one IMMEDIATE
 * transaction together with its idempotency record, so a write and its stored response are saved
 * together or not at all (design §6.4, §12.5). Accepted writes are published to `AuctionEvents`
 * after the transaction commits, never for replays (design §6.1).
 */
export class BidService {
  constructor(
    private readonly db: Db,
    private readonly vehicles: VehicleRepository,
    private readonly bids: BidRepository,
    private readonly idempotency: IdempotencyRepository,
    private readonly clock: AuctionClock,
    private readonly events: AuctionEvents,
  ) {}

  placeBid(command: PlaceBidCommand): BidResult {
    const { amount, expectedCurrentBid } = command.request;
    const hash = hashRequest([PLACE_BID, command.vehicleId, amount, expectedCurrentBid]);
    return this.runIdempotent(PLACE_BID, command, hash, (now) => this.evaluateBid(command, now));
  }

  buyNow(command: BuyNowCommand): BidResult {
    const hash = hashRequest([BUY_NOW, command.vehicleId]);
    return this.runIdempotent(BUY_NOW, command, hash, (now) => this.evaluateBuyNow(command, now));
  }

  private runIdempotent(
    endpoint: string,
    { user, idempotencyKey }: AuctionCommand,
    requestHash: string,
    evaluate: (now: number) => Outcome,
  ): BidResult {
    const run = this.db.transaction((): BidResult & { event?: AuctionEvent } => {
      const stored = this.idempotency.find(user.id, idempotencyKey);
      if (stored) {
        if (stored.endpoint !== endpoint || stored.requestHash !== requestHash) {
          throw problemError(
            422,
            'IDEMPOTENCY_KEY_REUSED',
            'This idempotency key was already used for a different request.',
          );
        }
        return {
          status: stored.responseStatus,
          body: stored.responseBody as AuctionState | Problem,
          replayed: true,
        };
      }

      const now = this.clock.now();
      const { status, body, event } = evaluate(now);
      this.idempotency.save({
        userId: user.id,
        key: idempotencyKey,
        endpoint,
        requestHash,
        responseStatus: status,
        responseBody: body,
        createdAt: now,
      });
      return { status, body, event, replayed: false };
    });
    const { event, ...result } = run.immediate();
    if (event) this.events.publish(event);
    return result;
  }

  private evaluateBid({ user, vehicleId, request, log }: PlaceBidCommand, now: number): Outcome {
    const vehicle = this.vehicles.findById(vehicleId);
    if (!vehicle) return vehicleNotFound();

    const evaluation = evaluateBid(vehicle, { bidderId: user.id, ...request }, now);
    if (!evaluation.accepted) {
      const status = evaluation.code === 'BID_TOO_HIGH' ? 422 : 409;
      const auction = this.stateFor(vehicle, user, now);
      log.info(
        { vehicleId, userId: user.id, amount: request.amount, outcome: evaluation.code },
        'Bid rejected',
      );
      return {
        status,
        body: problem(
          status,
          evaluation.code,
          bidRejectionDetail(evaluation.code, auction),
          status === 409 ? { auction } : {},
        ),
      };
    }

    this.bids.insert({
      id: randomUUID(),
      vehicleId,
      userId: user.id,
      amount: request.amount,
      createdAt: now,
    });
    this.vehicles.recordAcceptedBid(vehicleId, request.amount, user.id);
    log.info(
      { vehicleId, userId: user.id, amount: request.amount, outcome: 'ACCEPTED' },
      'Bid accepted',
    );
    return {
      status: 201,
      body: this.stateFor(this.vehicles.findById(vehicleId)!, user, now),
      event: { type: 'bid_accepted', vehicleId, bidderId: user.id, amount: request.amount },
    };
  }

  private evaluateBuyNow({ user, vehicleId, log }: BuyNowCommand, now: number): Outcome {
    const vehicle = this.vehicles.findById(vehicleId);
    if (!vehicle) return vehicleNotFound();

    const evaluation = evaluateBuyNow(vehicle, now);
    if (!evaluation.accepted) {
      const auction = this.stateFor(vehicle, user, now);
      log.info({ vehicleId, userId: user.id, outcome: evaluation.code }, 'Buy Now rejected');
      return {
        status: 409,
        body: problem(409, evaluation.code, buyNowRejectionDetail(evaluation.code, auction), {
          auction,
        }),
      };
    }

    this.vehicles.recordBuyNow(vehicleId, user.id, now);
    log.info(
      { vehicleId, userId: user.id, amount: vehicle.buyNowPrice, outcome: 'PURCHASED' },
      'Buy Now purchase',
    );
    return {
      status: 201,
      body: this.stateFor(this.vehicles.findById(vehicleId)!, user, now),
      event: { type: 'bought', vehicleId, buyerId: user.id },
    };
  }

  private stateFor(vehicle: VehicleRecord, user: User, now: number): AuctionState {
    return toAuctionState(
      vehicle,
      { userId: user.id, hasBid: this.bids.hasBid(user.id, vehicle.id) },
      now,
    );
  }
}

function vehicleNotFound(): Outcome {
  return {
    status: 404,
    body: problem(404, 'VEHICLE_NOT_FOUND', 'There is no vehicle with that ID.'),
  };
}

function notLiveDetail(auction: AuctionState): string {
  return auction.status === 'upcoming' ? "Bidding hasn't opened yet." : 'This auction has ended.';
}

function bidRejectionDetail(code: BidRejectionCode, auction: AuctionState): string {
  const minimum = auction.minNextBid === null ? '' : formatCad(auction.minNextBid);
  switch (code) {
    case 'BID_TOO_HIGH':
      return `Bids are limited to ${formatCad(MAX_BID_AMOUNT)}.`;
    case 'AUCTION_NOT_LIVE':
      return notLiveDetail(auction);
    case 'PRICE_CHANGED':
      return auction.currentBid === null
        ? `The price changed before your bid was placed. The minimum bid is ${minimum}.`
        : `Another bid came in first. The current bid is now ${formatCad(auction.currentBid)}, and the minimum next bid is ${minimum}.`;
    case 'ALREADY_HIGH_BIDDER':
      return "You're already the high bidder.";
    case 'BID_TOO_LOW':
      return `The minimum next bid is ${minimum}.`;
  }
}

function buyNowRejectionDetail(code: BuyNowRejectionCode, auction: AuctionState): string {
  switch (code) {
    case 'AUCTION_NOT_LIVE':
      return notLiveDetail(auction);
    case 'BUY_NOW_UNAVAILABLE':
      return auction.buyNowPrice === null
        ? "This vehicle isn't offered through Buy Now."
        : 'Buy Now is no longer available: bidding has reached the Buy Now price.';
  }
}

function hashRequest(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
