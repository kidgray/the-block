import type { User } from '@the-block/shared';
import type { AuctionClock } from '../clock.js';
import type { SessionRepository } from '../repositories/session-repository.js';
import type { UserRepository } from '../repositories/user-repository.js';

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly clock: AuctionClock,
  ) {}

  /** Signs in as the seeded demo buyer; credentials are out of scope (design §7.4). */
  signIn(): { user: User; sessionId: string } {
    const user = this.users.findSignInUser();
    if (!user) throw new Error('The demo buyer is missing; run `npm run db:reset`.');
    return { user, sessionId: this.sessions.create(user.id, this.clock.now()) };
  }

  findUser(sessionId: string): User | undefined {
    return this.sessions.findUser(sessionId);
  }

  signOut(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
