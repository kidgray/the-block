import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { createApp, type AppDependencies, type TheBlock } from '../app.js';
import { AuctionClock } from '../clock.js';
import { openDatabase, type Db } from '../db/connection.js';
import { resetDatabase, SIMULATED_BIDDER_ID, type DatasetVehicle } from '../db/seed.js';

export const NOW = Date.parse('2026-10-31T15:00:00Z');
export const HOUR_MS = 3_600_000;

/** A dataset vehicle with sensible defaults. Its auction window is set later with `schedule()`. */
export function datasetVehicle(overrides: Partial<DatasetVehicle> = {}): DatasetVehicle {
  return {
    id: 'live-1',
    vin: '1HGCV1F30LA000001',
    year: 2020,
    make: 'Honda',
    model: 'Accord',
    trim: 'Sport',
    body_style: 'sedan',
    exterior_color: 'White',
    interior_color: 'Black',
    engine: '1.5L I4 Turbo',
    transmission: 'automatic',
    drivetrain: 'FWD',
    odometer_km: 48_000,
    fuel_type: 'gasoline',
    condition_grade: 4,
    condition_report: 'Clean.',
    damage_notes: [],
    title_status: 'clean',
    province: 'Ontario',
    city: 'Toronto',
    auction_start: '2026-04-05T19:00:00',
    starting_bid: 14_500,
    reserve_price: 25_000,
    buy_now_price: null,
    images: ['https://example.com/1.jpg'],
    selling_dealership: 'Lakeshore Motors',
    lot: 'A-0001',
    current_bid: 22_800,
    bid_count: 16,
    ...overrides,
  };
}

export type Window = 'live' | 'upcoming' | 'ended';

export interface ApiTestKit {
  app: Express;
  db: Db;
  /** The composed app: its event bus, simulator, and background work. */
  theBlock: TheBlock;
  /** The current time on the shared clock. */
  now(): number;
  /** Moves the shared clock. */
  setNow(time: number): void;
  /** Places the vehicle's auction relative to the current clock. */
  schedule(vehicleId: string, window: Window): void;
  /** Sets the vehicle's exact auction start and end. */
  setAuctionWindow(vehicleId: string, start: number, end: number): void;
  /** Records a rival's winning bid directly, as the simulated bidder would. */
  rivalBid(vehicleId: string, amount: number): void;
  /** A Supertest agent that is signed in as the Demo Buyer (it keeps the session cookie). */
  signedIn(): Promise<ReturnType<typeof request.agent>>;
}

/** Extra app options, such as the simulator or the dev endpoints. */
export type KitOptions = Omit<AppDependencies, 'db' | 'clock' | 'logger'>;

export function createApiTestKit(vehicles: DatasetVehicle[], options: KitOptions = {}): ApiTestKit {
  let now = NOW;
  const db = openDatabase(':memory:');
  resetDatabase(db, vehicles, now);
  for (const vehicle of vehicles) setWindow(db, vehicle.id, 'live', now);
  const theBlock = createApp({
    db,
    clock: new AuctionClock(() => now),
    logger: pino({ level: 'silent' }),
    ...options,
  });

  return {
    app: theBlock.app,
    db,
    theBlock,
    now: () => now,
    setNow: (time) => (now = time),
    schedule: (vehicleId, window) => setWindow(db, vehicleId, window, now),
    setAuctionWindow: (vehicleId, start, end) => {
      db.prepare('UPDATE vehicles SET auction_start = ?, auction_end = ? WHERE id = ?').run(
        start,
        end,
        vehicleId,
      );
    },
    rivalBid: (vehicleId, amount) => {
      db.prepare(
        `UPDATE vehicles
         SET current_bid = ?, bid_count = bid_count + 1, high_bidder_id = ?, version = version + 1
         WHERE id = ?`,
      ).run(amount, SIMULATED_BIDDER_ID, vehicleId);
    },
    signedIn: async () => {
      const agent = request.agent(theBlock.app);
      await agent.post('/api/session').send({}).expect(201);
      return agent;
    },
  };
}

function setWindow(db: Db, vehicleId: string, window: Window, now: number): void {
  const start = { live: now - HOUR_MS, upcoming: now + HOUR_MS, ended: now - 4 * HOUR_MS }[window];
  db.prepare('UPDATE vehicles SET auction_start = ?, auction_end = ? WHERE id = ?').run(
    start,
    start + 3 * HOUR_MS,
    vehicleId,
  );
}
