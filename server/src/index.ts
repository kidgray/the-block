import { createApp } from './app.js';
import { AuctionClock } from './clock.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/connection.js';
import { initializeDatabase } from './db/seed.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger(config);
const clock = new AuctionClock();
const db = openDatabase(config.dbPath);

const action = initializeDatabase(db, config.datasetPath, clock.now());
const messages = {
  seeded: 'Database created and seeded',
  reseeded: 'No live or upcoming auctions left; demo data re-seeded',
  kept: 'Using existing database',
} as const;
logger.info({ dbPath: config.dbPath }, messages[action]);

if (config.clientDir) logger.info({ clientDir: config.clientDir }, 'Serving the client build');

const theBlock = createApp({
  db,
  clock,
  logger,
  clientDir: config.clientDir,
  simulatedBidder: { ...config.simulatedBidder },
  enableDevEndpoints: config.enableDevEndpoints,
});
theBlock.start();
logger.info(
  {
    simulatedBidder: config.simulatedBidder.enabled,
    delayMs: config.simulatedBidder.delayMs,
    devEndpoints: config.enableDevEndpoints,
  },
  config.simulatedBidder.enabled ? 'Simulated bidder is on' : 'Simulated bidder is off',
);

const server = theBlock.app.listen(config.port, (error) => {
  if (error) {
    logger.fatal({ err: error }, 'Failed to start the API server');
    process.exit(1);
  }
  logger.info(`API listening on http://localhost:${config.port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'Shutting down');
  theBlock.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Open SSE streams never finish by themselves; browsers reconnect after a restart.
  server.closeAllConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
