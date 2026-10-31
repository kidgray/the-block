import type { User } from '@the-block/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by the session middleware when the `sid` cookie maps to a session. */
      user?: User;
      sessionId?: string;
    }
  }
}

export {};
