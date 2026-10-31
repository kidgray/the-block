import type { Db } from './connection.js';

/** Bump when the schema changes; a database with another version is rebuilt on startup. */
export const SCHEMA_VERSION = 1;

const CREATE_STATEMENTS = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('buyer', 'simulated')),
  can_sign_in INTEGER NOT NULL CHECK (can_sign_in IN (0, 1))
);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  vin TEXT NOT NULL,
  lot TEXT NOT NULL,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT NOT NULL,
  body_style TEXT NOT NULL,
  exterior_color TEXT NOT NULL,
  interior_color TEXT NOT NULL,
  engine TEXT NOT NULL,
  transmission TEXT NOT NULL,
  drivetrain TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  odometer_km INTEGER NOT NULL,
  condition_grade REAL NOT NULL,
  condition_report TEXT NOT NULL,
  damage_notes TEXT NOT NULL,
  title_status TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  selling_dealership TEXT NOT NULL,
  images TEXT NOT NULL,
  starting_bid INTEGER NOT NULL,
  reserve_price INTEGER,
  buy_now_price INTEGER,
  current_bid INTEGER,
  bid_count INTEGER NOT NULL DEFAULT 0,
  high_bidder_id TEXT REFERENCES users (id),
  auction_start INTEGER NOT NULL,
  auction_end INTEGER NOT NULL,
  buy_now_buyer_id TEXT REFERENCES users (id),
  version INTEGER NOT NULL DEFAULT 0,
  CHECK ((current_bid IS NULL) = (bid_count = 0))
);
CREATE INDEX vehicles_auction_end ON vehicles (auction_end);

CREATE TABLE bids (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at INTEGER NOT NULL
);
CREATE INDEX bids_vehicle_created ON bids (vehicle_id, created_at);
CREATE INDEX bids_user ON bids (user_id);

CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES users (id),
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id),
  PRIMARY KEY (user_id, vehicle_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL
);

CREATE TABLE idempotency_keys (
  user_id TEXT NOT NULL REFERENCES users (id),
  idempotency_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, idempotency_key)
);
`;

/** Child tables first, so foreign keys never point at a dropped table. */
const TABLES_IN_DROP_ORDER = [
  'idempotency_keys',
  'sessions',
  'favorites',
  'bids',
  'vehicles',
  'users',
];

export function dropSchema(db: Db): void {
  for (const table of TABLES_IN_DROP_ORDER) db.exec(`DROP TABLE IF EXISTS ${table}`);
}

export function createSchema(db: Db): void {
  db.exec(CREATE_STATEMENTS);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

export function schemaVersion(db: Db): number {
  return db.pragma('user_version', { simple: true }) as number;
}
