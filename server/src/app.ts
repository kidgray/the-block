import { randomUUID } from 'node:crypto';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { AuctionClock } from './clock.js';
import type { Db } from './db/connection.js';
import { AuctionEvents } from './events/auction-events.js';
import { errorHandler } from './http/middleware.js';
import { apiRouter } from './http/routes.js';
import { BidRepository } from './repositories/bid-repository.js';
import { FavoriteRepository } from './repositories/favorite-repository.js';
import { IdempotencyRepository } from './repositories/idempotency-repository.js';
import { SessionRepository } from './repositories/session-repository.js';
import { UserRepository } from './repositories/user-repository.js';
import { VehicleRepository } from './repositories/vehicle-repository.js';
import { AuctionStatusWatcher } from './services/auction-status-watcher.js';
import { BidService } from './services/bid-service.js';
import { SessionService } from './services/session-service.js';
import { SimulatedBidder, type SimulatedBidderOptions } from './services/simulated-bidder.js';
import { VehicleService } from './services/vehicle-service.js';

export interface AppDependencies {
  db: Db;
  clock: AuctionClock;
  logger: Logger;
  /** The Angular browser build to serve after the API (design §15), or null to serve the API only. */
  clientDir?: string | null;
  /** The rival bidder (design §6.2). Its automatic counter-bids are off unless `enabled`. */
  simulatedBidder?: SimulatedBidderOptions & { enabled: boolean };
  /** Registers the walkthrough-only override endpoint (design §6.2). */
  enableDevEndpoints?: boolean;
  /** SSE keep-alive interval; tests shorten it. */
  keepAliveMs?: number;
}

/** The composed application. `start()` begins the background work: status timers and the simulator. */
export interface TheBlock {
  app: Express;
  events: AuctionEvents;
  simulator: SimulatedBidder | null;
  start(): void;
  stop(): void;
}

const DEFAULT_SIMULATOR: SimulatedBidderOptions & { enabled: boolean } = {
  enabled: false,
  seed: 'the-block',
  delayMs: { min: 3_000, max: 10_000 },
};

export function createApp({
  db,
  clock,
  logger,
  clientDir = null,
  simulatedBidder = DEFAULT_SIMULATOR,
  enableDevEndpoints = false,
  keepAliveMs,
}: AppDependencies): TheBlock {
  const events = new AuctionEvents((error, event) =>
    logger.error({ err: error, event }, 'An auction event listener failed'),
  );
  const vehicleRepository = new VehicleRepository(db);
  const bidRepository = new BidRepository(db);
  const userRepository = new UserRepository(db);
  const bids = new BidService(
    db,
    vehicleRepository,
    bidRepository,
    new IdempotencyRepository(db),
    clock,
    events,
  );
  const statusWatcher = new AuctionStatusWatcher(vehicleRepository, clock, events);
  const simulatedUser = userRepository.findSimulatedBidder();
  const simulator = simulatedUser
    ? new SimulatedBidder(
        simulatedUser,
        bids,
        vehicleRepository,
        events,
        clock,
        logger.child({ component: 'simulated-bidder' }),
        simulatedBidder,
      )
    : null;

  const app = express();
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const header = req.headers['x-request-id'];
        const id = typeof header === 'string' && header.length > 0 ? header : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Vehicle photos come from the dataset's image host.
          'img-src': ["'self'", 'data:', 'https:'],
          // The container serves plain HTTP on localhost; upgrading requests would break it.
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use(
    '/api',
    apiRouter({
      sessions: new SessionService(new SessionRepository(db), userRepository, clock),
      vehicles: new VehicleService(
        vehicleRepository,
        bidRepository,
        new FavoriteRepository(db),
        clock,
      ),
      bids,
      events,
      devSimulator: enableDevEndpoints ? simulator : null,
      keepAliveMs,
    }),
  );
  if (clientDir) serveClient(app, clientDir);
  app.use(errorHandler);

  return {
    app,
    events,
    simulator,
    start() {
      statusWatcher.start();
      if (simulatedBidder.enabled) simulator?.start();
    },
    stop() {
      statusWatcher.stop();
      simulator?.stop();
    },
  };
}

/**
 * Static files, then the SPA fallback (design §15). Unknown `/api` paths never get here: the API
 * router answers them with a JSON 404. Hashed bundles are cached for a year; index.html never is.
 */
function serveClient(app: Express, clientDir: string): void {
  const indexFile = path.join(clientDir, 'index.html');
  app.use(
    express.static(clientDir, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, file) => {
        if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  // Express 5 requires a named wildcard.
  app.get('/{*splat}', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}
