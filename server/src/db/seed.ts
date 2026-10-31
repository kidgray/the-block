import fs from 'node:fs';
import { TitleStatusSchema } from '@the-block/shared';
import { z } from 'zod';
import { mapSchedule, parseDatasetTimestamp } from '../domain/schedule.js';
import type { Db } from './connection.js';
import { createSchema, dropSchema, SCHEMA_VERSION, schemaVersion } from './schema.js';

export const DEMO_BUYER_ID = 'demo-buyer';
export const SIMULATED_BIDDER_ID = 'sim-bidder-1';

const DatasetVehicleSchema = z.object({
  id: z.string(),
  vin: z.string(),
  year: z.int(),
  make: z.string(),
  model: z.string(),
  trim: z.string(),
  body_style: z.string(),
  exterior_color: z.string(),
  interior_color: z.string(),
  engine: z.string(),
  transmission: z.string(),
  drivetrain: z.string(),
  odometer_km: z.int().nonnegative(),
  fuel_type: z.string(),
  condition_grade: z.number(),
  condition_report: z.string(),
  damage_notes: z.array(z.string()),
  title_status: TitleStatusSchema,
  province: z.string(),
  city: z.string(),
  auction_start: z.string(),
  starting_bid: z.int().positive(),
  reserve_price: z.int().positive().nullable(),
  buy_now_price: z.int().positive().nullable(),
  images: z.array(z.string()).min(1),
  selling_dealership: z.string(),
  lot: z.string(),
  current_bid: z.int().positive().nullable(),
  bid_count: z.int().nonnegative(),
});
export type DatasetVehicle = z.infer<typeof DatasetVehicleSchema>;

export function loadDataset(file: string): DatasetVehicle[] {
  return z.array(DatasetVehicleSchema).parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** Drops everything and seeds from the dataset, anchoring the auction schedule at `seedTime` (design §8.4). */
export function resetDatabase(db: Db, vehicles: DatasetVehicle[], seedTime: number): void {
  db.transaction(() => {
    dropSchema(db);
    createSchema(db);
    seed(db, vehicles, seedTime);
  })();
}

export type InitializeAction = 'seeded' | 'reseeded' | 'kept';

/**
 * Seeds a new (or outdated) database, and re-seeds one in which no auction is live or upcoming,
 * so the app never starts into a marketplace where everything has ended (design §8.4, D12).
 */
export function initializeDatabase(db: Db, datasetFile: string, now: number): InitializeAction {
  if (schemaVersion(db) !== SCHEMA_VERSION) {
    resetDatabase(db, loadDataset(datasetFile), now);
    return 'seeded';
  }
  const open = db
    .prepare('SELECT COUNT(*) FROM vehicles WHERE buy_now_buyer_id IS NULL AND auction_end > ?')
    .pluck()
    .get(now) as number;
  if (open > 0) return 'kept';
  resetDatabase(db, loadDataset(datasetFile), now);
  return 'reseeded';
}

function seed(db: Db, vehicles: DatasetVehicle[], seedTime: number): void {
  const insertUser = db.prepare(
    'INSERT INTO users (id, display_name, kind, can_sign_in) VALUES (?, ?, ?, ?)',
  );
  insertUser.run(DEMO_BUYER_ID, 'Demo Buyer', 'buyer', 1);
  insertUser.run(SIMULATED_BIDDER_ID, 'Another bidder', 'simulated', 0);

  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (
      id, vin, lot, year, make, model, trim, body_style, exterior_color, interior_color,
      engine, transmission, drivetrain, fuel_type, odometer_km, condition_grade, condition_report,
      damage_notes, title_status, city, province, selling_dealership, images,
      starting_bid, reserve_price, buy_now_price, current_bid, bid_count, auction_start, auction_end
    ) VALUES (
      @id, @vin, @lot, @year, @make, @model, @trim, @body_style, @exterior_color, @interior_color,
      @engine, @transmission, @drivetrain, @fuel_type, @odometer_km, @condition_grade, @condition_report,
      @damage_notes, @title_status, @city, @province, @selling_dealership, @images,
      @starting_bid, @reserve_price, @buy_now_price, @current_bid, @bid_count, @auction_start, @auction_end
    )`);

  const windows = mapSchedule(
    vehicles.map((vehicle) => parseDatasetTimestamp(vehicle.auction_start)),
    seedTime,
  );
  vehicles.forEach((vehicle, index) => {
    const window = windows[index]!;
    insertVehicle.run({
      ...vehicle,
      damage_notes: JSON.stringify(vehicle.damage_notes),
      images: JSON.stringify(vehicle.images),
      auction_start: window.start,
      auction_end: window.end,
    });
  });
}
