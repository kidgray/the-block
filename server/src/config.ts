import path from 'node:path';
import type { Range } from './services/simulated-bidder.js';

const serverRoot = path.resolve(import.meta.dirname, '..');

export interface SimulatedBidderConfig {
  enabled: boolean;
  seed: string;
  delayMs: Range;
}

export interface Config {
  port: number;
  dbPath: string;
  datasetPath: string;
  /** The Angular browser build to serve next to the API, or null when the dev server serves it. */
  clientDir: string | null;
  logLevel: string;
  prettyLogs: boolean;
  /** Design §6.2: the rival bidder that answers the buyer's bids. */
  simulatedBidder: SimulatedBidderConfig;
  /** Registers `POST /api/dev/vehicles/:vehicleId/simulate-bid` (design §6.2). */
  enableDevEndpoints: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT ?? 3000),
    dbPath: env.DB_PATH ?? path.join(serverRoot, 'data', 'the-block.db'),
    datasetPath: env.DATASET_PATH ?? path.resolve(serverRoot, '..', 'data', 'vehicles.json'),
    clientDir:
      env.CLIENT_DIR ??
      (production ? path.resolve(serverRoot, '..', 'client', 'dist', 'client', 'browser') : null),
    logLevel: env.LOG_LEVEL ?? 'info',
    prettyLogs: !production,
    simulatedBidder: {
      enabled: flag(env.SIM_BIDDER_ENABLED, true),
      seed: env.SIM_BIDDER_SEED ?? 'the-block',
      delayMs: parseRange(env.SIM_BIDDER_DELAY_MS ?? '3000-10000', 'SIM_BIDDER_DELAY_MS'),
    },
    enableDevEndpoints: flag(env.ENABLE_DEV_ENDPOINTS, !production),
  };
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

/** "3000-10000" → { min: 3000, max: 10000 }; a single number means a fixed value. */
export function parseRange(value: string, name: string): Range {
  const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(value);
  if (!match) throw new Error(`${name} must look like "3000-10000"; got "${value}".`);
  const min = Number(match[1]);
  const max = Number(match[2] ?? match[1]);
  if (max < min) throw new Error(`${name} has its maximum below its minimum: "${value}".`);
  return { min, max };
}
