import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, throwError, timer } from 'rxjs';
import { SessionService } from '../session/session.service';
import { SignInService } from '../session/sign-in.service';
import { ApiProblem } from './api-problem';
import { IDEMPOTENCY_KEY } from './context';

const MAX_RETRIES = 2;

/**
 * Sends the idempotency key and retries transient failures (design §12.5): network errors and
 * 5xx responses, GETs always, POSTs only when they carry an idempotency key. 4xx never retries.
 */
export const idempotencyRetryInterceptor: HttpInterceptorFn = (req, next) => {
  const key = req.context.get(IDEMPOTENCY_KEY);
  const request = key ? req.clone({ setHeaders: { 'Idempotency-Key': key } }) : req;
  if (request.method !== 'GET' && !key) return next(request);

  return next(request).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error: unknown, retryCount) =>
        isTransient(error) ? timer(250 * 2 ** retryCount) : throwError(() => error),
    }),
  );
};

/** Converts error responses into typed `ApiProblem`s that components can act on. */
export const problemInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((error: unknown) => throwError(() => ApiProblem.from(error))));

/**
 * On 401 (for example after a re-seed cleared the session), marks the buyer as signed out and
 * offers the sign-in dialog. Never re-sends the request: writes are re-confirmed by the buyer.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const signIn = inject(SignInService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof ApiProblem && error.code === 'AUTH_REQUIRED') {
        session.markSignedOut();
        signIn.prompt().subscribe();
      }
      return throwError(() => error);
    }),
  );
};

function isTransient(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}
