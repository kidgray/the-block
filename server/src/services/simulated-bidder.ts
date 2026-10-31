import { randomUUID } from 'node:crypto';
import type { User } from '@the-block/shared';
import type { Logger } from 'pino';
import type { AuctionClock } from '../clock.js';
import { auctionStatus, minNextBid, type AuctionFacts } from '../domain/auction.js';
import type { AuctionEvent, AuctionEvents } from '../events/auction-events.js';
import { seededRandom, stableUnit } from '../random.js';
import type { VehicleRepository } from '../repositories/vehicle-repository.js';
import type { BidResult, BidService } from './bid-service.js';

export interface Range {
  min: number;
  max: number;
}

export interface SimulatedBidderOptions {
  /** Makes ceilings and delays reproducible. */
  seed: string;
  /** How long after a buyer's bid the counter-bid comes, in milliseconds. */
  delayMs: Range;
  /**
   * How far above its base each vehicle's ceiling lies, as a fraction: the base is the reserve, or
   * the current (or starting) bid when there is no reserve.
   */
  ceilingBand?: Range;
}

export type SkipReason = 'not_live' | 'buyer_outbid' | 'ceiling_reached';

const DEFAULT_CEILING_BAND: Range = { min: 0.02, max: 0.15 };

/**
 * A rival bidder that reacts to the real buyer (design §6.2, D4). When a buyer's bid is accepted on
 * a live auction, it schedules one counter-bid at the minimum next bid after a random delay. It
 * bids through `BidService`, like any buyer, and stops at a hidden per-vehicle ceiling so the buyer
 * can always win.
 */
export class SimulatedBidder {
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly ceilings = new Map<string, number>();
  private readonly random: () => number;
  private readonly band: Range;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly bidder: User,
    private readonly bids: BidService,
    private readonly vehicles: VehicleRepository,
    private readonly events: AuctionEvents,
    private readonly clock: AuctionClock,
    private readonly log: Logger,
    private readonly options: SimulatedBidderOptions,
  ) {
    this.random = seededRandom(options.seed);
    this.band = options.ceilingBand ?? DEFAULT_CEILING_BAND;
  }

  /** Draws every vehicle's ceiling and starts reacting to buyers' bids. */
  start(): void {
    this.stop();
    for (const vehicle of this.vehicles.findAll()) {
      this.ceilings.set(vehicle.id, this.drawCeiling(vehicle.id, vehicle));
    }
    this.unsubscribe = this.events.subscribe((event) => this.onEvent(event));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** The hidden maximum this bidder will pay for a vehicle. */
  ceilingFor(vehicleId: string, facts: AuctionFacts): number {
    let ceiling = this.ceilings.get(vehicleId);
    if (ceiling === undefined) {
      ceiling = this.drawCeiling(vehicleId, facts);
      this.ceilings.set(vehicleId, ceiling);
    }
    return ceiling;
  }

  /**
   * The walkthrough override (design §6.2): an immediate counter-bid at the minimum next bid,
   * ignoring the ceiling. The usual bid rules still apply.
   */
  bidNow(vehicleId: string): BidResult | null {
    const vehicle = this.vehicles.findById(vehicleId);
    if (!vehicle) return null;
    return this.place(vehicleId, minNextBid(vehicle), vehicle.currentBid);
  }

  private onEvent(event: AuctionEvent): void {
    switch (event.type) {
      case 'bid_accepted':
        if (event.bidderId !== this.bidder.id) this.schedule(event.vehicleId, event.bidderId);
        break;
      case 'bought':
        this.cancel(event.vehicleId);
        break;
      case 'status_changed':
        if (event.status === 'ended') this.cancel(event.vehicleId);
        break;
    }
  }

  private schedule(vehicleId: string, buyerId: string): void {
    this.cancel(vehicleId);
    const { min, max } = this.options.delayMs;
    const delay = min + Math.floor(this.random() * (max - min + 1));
    const timer = setTimeout(() => {
      this.pending.delete(vehicleId);
      this.counterBid(vehicleId, buyerId);
    }, delay);
    timer.unref?.();
    this.pending.set(vehicleId, timer);
  }

  private cancel(vehicleId: string): void {
    const timer = this.pending.get(vehicleId);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.pending.delete(vehicleId);
  }

  /** Bids only if the auction is live, the buyer still leads, and the price is within the ceiling. */
  private counterBid(vehicleId: string, buyerId: string): void {
    const vehicle = this.vehicles.findById(vehicleId);
    if (!vehicle) return;
    const reason = this.skipReason(vehicleId, vehicle, buyerId);
    if (reason !== null) {
      this.log.debug({ vehicleId, reason }, 'Simulated bidder skipped a counter-bid');
      return;
    }
    this.place(vehicleId, minNextBid(vehicle), vehicle.currentBid);
  }

  private skipReason(vehicleId: string, vehicle: AuctionFacts, buyerId: string): SkipReason | null {
    if (auctionStatus(vehicle, this.clock.now()) !== 'live') return 'not_live';
    if (vehicle.highBidderId !== buyerId) return 'buyer_outbid';
    if (minNextBid(vehicle) > this.ceilingFor(vehicleId, vehicle)) return 'ceiling_reached';
    return null;
  }

  private place(vehicleId: string, amount: number, expectedCurrentBid: number | null): BidResult {
    return this.bids.placeBid({
      user: this.bidder,
      vehicleId,
      request: { amount, expectedCurrentBid },
      idempotencyKey: `sim-${randomUUID()}`,
      log: this.log,
    });
  }

  private drawCeiling(vehicleId: string, facts: AuctionFacts): number {
    const base = facts.reservePrice ?? Math.max(facts.currentBid ?? 0, facts.startingBid);
    const { min, max } = this.band;
    const markup = min + stableUnit(this.options.seed, vehicleId) * (max - min);
    return Math.round(base * (1 + markup));
  }
}
