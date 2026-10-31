import express, { type Request, type Response, type Router } from 'express';
import {
  BuyNowRequestSchema,
  ListVehiclesQuerySchema,
  PlaceBidRequestSchema,
} from '@the-block/shared';
import { z } from 'zod';
import type { AuctionEvents } from '../events/auction-events.js';
import { problemError } from '../problems.js';
import type { BidService } from '../services/bid-service.js';
import type { SessionService } from '../services/session-service.js';
import type { SimulatedBidder } from '../services/simulated-bidder.js';
import type { VehicleService } from '../services/vehicle-service.js';
import { streamAuction } from './auction-stream.js';
import {
  notFound,
  requireAuth,
  requireJsonForWrites,
  resolveSession,
  SESSION_COOKIE,
} from './middleware.js';

export interface ApiServices {
  sessions: SessionService;
  vehicles: VehicleService;
  bids: BidService;
  events: AuctionEvents;
  /** Present when the walkthrough-only override endpoint is enabled (design §6.2). */
  devSimulator?: SimulatedBidder | null;
  keepAliveMs?: number;
}

const IdempotencyKeySchema = z.string().trim().min(1).max(200);
const VehicleIdSchema = z.string().min(1).max(64);

export function apiRouter({
  sessions,
  vehicles,
  bids,
  events,
  devSimulator = null,
  keepAliveMs,
}: ApiServices): Router {
  const api = express.Router();
  api.use(requireJsonForWrites);
  api.use(express.json({ limit: '10kb' }));
  api.use(resolveSession(sessions));

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  api.get('/session', (req, res) => {
    res.json({ user: req.user ?? null });
  });

  api.post('/session', (req, res) => {
    if (req.user) {
      res.status(200).json(req.user);
      return;
    }
    const { user, sessionId } = sessions.signIn();
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: req.secure,
    });
    res.status(201).json(user);
  });

  api.delete('/session', (req, res) => {
    if (req.sessionId) sessions.signOut(req.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  api.get('/me', requireAuth, (req, res) => {
    res.json(req.user);
  });

  api.get('/vehicles', (req, res) => {
    res.json(vehicles.list(ListVehiclesQuerySchema.parse(req.query), req.user ?? null));
  });

  // Registered before '/vehicles/:vehicleId', which would otherwise treat "facets" as an ID.
  api.get('/vehicles/facets', (_req, res) => {
    res.json(vehicles.facets());
  });

  api.get('/vehicles/:vehicleId', (req, res) => {
    res.json(vehicles.get(VehicleIdSchema.parse(req.params.vehicleId), req.user ?? null));
  });

  api.get('/vehicles/:vehicleId/events', (req, res) => {
    const vehicleId = VehicleIdSchema.parse(req.params.vehicleId);
    const user = req.user ?? null;
    streamAuction(res, {
      vehicleId,
      events,
      snapshot: () => vehicles.auctionState(vehicleId, user),
      keepAliveMs,
    });
  });

  api.post('/vehicles/:vehicleId/bids', requireAuth, (req, res) => {
    const idempotencyKey = idempotencyKeyOf(req);
    const result = bids.placeBid({
      user: req.user!,
      vehicleId: VehicleIdSchema.parse(req.params.vehicleId),
      request: PlaceBidRequestSchema.parse(req.body),
      idempotencyKey,
      log: req.log,
    });
    if (result.replayed) res.set('Idempotent-Replayed', 'true');
    send(res, result.status, result.body);
  });

  api.post('/vehicles/:vehicleId/buy-now', requireAuth, (req, res) => {
    const idempotencyKey = idempotencyKeyOf(req);
    BuyNowRequestSchema.parse(req.body);
    const result = bids.buyNow({
      user: req.user!,
      vehicleId: VehicleIdSchema.parse(req.params.vehicleId),
      idempotencyKey,
      log: req.log,
    });
    if (result.replayed) res.set('Idempotent-Replayed', 'true');
    send(res, result.status, result.body);
  });

  api.get('/me/bids', requireAuth, (req, res) => {
    res.json(vehicles.myBids(req.user!));
  });

  api.get('/me/favorites', requireAuth, (req, res) => {
    res.json(vehicles.favoritesOf(req.user!));
  });

  api.put('/me/favorites/:vehicleId', requireAuth, (req, res) => {
    vehicles.addFavorite(req.user!, VehicleIdSchema.parse(req.params.vehicleId));
    res.status(204).end();
  });

  api.delete('/me/favorites/:vehicleId', requireAuth, (req, res) => {
    vehicles.removeFavorite(req.user!, VehicleIdSchema.parse(req.params.vehicleId));
    res.status(204).end();
  });

  // Walkthrough only, never in production (design §6.2, §12.2): an immediate counter-bid.
  if (devSimulator) {
    api.post('/dev/vehicles/:vehicleId/simulate-bid', (req, res) => {
      const vehicleId = VehicleIdSchema.parse(req.params.vehicleId);
      const result = devSimulator.bidNow(vehicleId);
      if (!result)
        throw problemError(404, 'VEHICLE_NOT_FOUND', 'There is no vehicle with that ID.');
      send(res, result.status, result.body);
    });
  }

  api.use(notFound);
  return api;
}

/** Bids and Buy Now require an Idempotency-Key header (design §12.5, D19). */
function idempotencyKeyOf(req: Request): string {
  const rawKey = req.get('Idempotency-Key');
  if (rawKey === undefined) {
    throw problemError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Send an Idempotency-Key header with every bid and Buy Now request.',
    );
  }
  return IdempotencyKeySchema.parse(rawKey);
}

function send(res: Response, status: number, body: unknown): void {
  if (status >= 400) res.type('application/problem+json');
  res.status(status).json(body);
}
