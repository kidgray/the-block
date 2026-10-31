import { randomBytes } from 'node:crypto';
import type { User } from '@the-block/shared';
import type { Db } from '../db/connection.js';

export class SessionRepository {
  constructor(private readonly db: Db) {}

  /** Creates a session with a random 256-bit ID (design §7.4). */
  create(userId: string, now: number): string {
    const id = randomBytes(32).toString('hex');
    this.db
      .prepare('INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)')
      .run(id, userId, now);
    return id;
  }

  findUser(sessionId: string): User | undefined {
    return this.db
      .prepare(
        `SELECT u.id, u.display_name AS displayName
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ?`,
      )
      .get(sessionId) as User | undefined;
  }

  delete(sessionId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }
}
