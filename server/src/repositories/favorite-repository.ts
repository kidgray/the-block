import type { Db } from '../db/connection.js';

/** A buyer's favorite vehicles (design §7.6). Adding and removing are idempotent. */
export class FavoriteRepository {
  constructor(private readonly db: Db) {}

  add(userId: string, vehicleId: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO favorites (user_id, vehicle_id) VALUES (?, ?)')
      .run(userId, vehicleId);
  }

  remove(userId: string, vehicleId: string): void {
    this.db
      .prepare('DELETE FROM favorites WHERE user_id = ? AND vehicle_id = ?')
      .run(userId, vehicleId);
  }

  isFavorite(userId: string, vehicleId: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND vehicle_id = ?')
        .get(userId, vehicleId) !== undefined
    );
  }

  /** Which of the given vehicles the user has favorited, in one query. */
  vehicleIdsFavoritedBy(userId: string, vehicleIds: string[]): Set<string> {
    if (vehicleIds.length === 0) return new Set();
    const placeholders = vehicleIds.map(() => '?').join(', ');
    const ids = this.db
      .prepare(
        `SELECT vehicle_id FROM favorites WHERE user_id = ? AND vehicle_id IN (${placeholders})`,
      )
      .pluck()
      .all(userId, ...vehicleIds) as string[];
    return new Set(ids);
  }
}
