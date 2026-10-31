import type { User } from '@the-block/shared';
import type { Db } from '../db/connection.js';

export class UserRepository {
  constructor(private readonly db: Db) {}

  /** The seeded demo buyer: the only user who can sign in (design §7.4). */
  findSignInUser(): User | undefined {
    return this.db
      .prepare(
        `SELECT id, display_name AS displayName FROM users
         WHERE can_sign_in = 1 AND kind = 'buyer' ORDER BY id LIMIT 1`,
      )
      .get() as User | undefined;
  }

  /** The seeded simulated bidder, shown to buyers as "Another bidder" (design §6.2). */
  findSimulatedBidder(): User | undefined {
    return this.db
      .prepare(
        `SELECT id, display_name AS displayName FROM users WHERE kind = 'simulated' ORDER BY id LIMIT 1`,
      )
      .get() as User | undefined;
  }
}
