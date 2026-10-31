import { loadConfig } from '../config.js';
import { openDatabase } from './connection.js';
import { loadDataset, resetDatabase } from './seed.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);
resetDatabase(db, loadDataset(config.datasetPath), Date.now());
db.close();
console.log(`Demo data reset: ${config.dbPath}`);
