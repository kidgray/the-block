import type { Db } from '../db/connection.js';

export interface NewBid {
  id: string;
  vehicleId: string;
  userId: string;
  amount: number;
  createdAt: number;
}

export class BidRepository {
  constructor(private readonly db: Db) {}

  insert(bid: NewBid): void {
    this.db
      .prepare(
        'INSERT INTO bids (id, vehicle_id, user_id, amount, created_at) VALUES (@id, @vehicleId, @userId, @amount, @createdAt)',
      )
      .run(bid);
  }

  hasBid(userId: string, vehicleId: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM bids WHERE user_id = ? AND vehicle_id = ? LIMIT 1')
        .get(userId, vehicleId) !== undefined
    );
  }

  /** Which of the given vehicles the user has bid on, in one query. */
  vehicleIdsBidOnBy(userId: string, vehicleIds: string[]): Set<string> {
    if (vehicleIds.length === 0) return new Set();
    const placeholders = vehicleIds.map(() => '?').join(', ');
    const ids = this.db
      .prepare(
        `SELECT DISTINCT vehicle_id FROM bids WHERE user_id = ? AND vehicle_id IN (${placeholders})`,
      )
      .pluck()
      .all(userId, ...vehicleIds) as string[];
    return new Set(ids);
  }
}
