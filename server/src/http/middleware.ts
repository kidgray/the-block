import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Problem } from '@the-block/shared';
import { ZodError } from 'zod';
import { problem, problemError, ProblemError } from '../problems.js';
import type { SessionService } from '../services/session-service.js';

export const SESSION_COOKIE = 'sid';

/** Resolves the `sid` cookie to a user (design §7.4). Unknown or stale IDs are treated as signed out. */
export function resolveSession(sessions: SessionService): RequestHandler {
  return (req, _res, next) => {
    const sessionId: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof sessionId === 'string') {
      const user = sessions.findUser(sessionId);
      if (user) {
        req.user = user;
        req.sessionId = sessionId;
      }
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : problemError(401, 'AUTH_REQUIRED', 'Sign in to continue.'));
};

/**
 * Write requests must be JSON (design §7.4): a cross-site HTML form cannot send
 * `application/json`, which, together with SameSite cookies, protects against CSRF.
 */
export const requireJsonForWrites: RequestHandler = (req, _res, next) => {
  const isWrite = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH';
  const contentType = req.headers['content-type'] ?? '';
  next(
    isWrite && !/^application\/json\b/i.test(contentType)
      ? problemError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send request bodies as application/json.')
      : undefined,
  );
};

export const notFound: RequestHandler = (req, _res, next) => {
  next(problemError(404, 'NOT_FOUND', `No API route for ${req.method} ${req.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const body = toProblem(error);
  if (body.status >= 500) req.log.error({ err: error }, 'Unhandled error');
  res.status(body.status).type('application/problem+json').json(body);
};

function toProblem(error: unknown): Problem {
  if (error instanceof ProblemError) return error.problem;
  if (error instanceof ZodError) {
    return problem(422, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', {
      errors: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  const type = (error as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') return problem(400, 'INVALID_JSON');
  if (type === 'entity.too.large') return problem(413, 'PAYLOAD_TOO_LARGE');
  return problem(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
}
