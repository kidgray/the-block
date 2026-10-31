import { HttpErrorResponse } from '@angular/common/http';
import type { AuctionState, Problem, ProblemCode } from '@the-block/shared';

export type ClientProblemCode = ProblemCode | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

/** A typed API error built from an RFC 9457 Problem Details response (design §13.4). */
export class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientProblemCode,
    readonly detail: string,
    /** The latest auction state, on 409 responses. */
    readonly auction?: AuctionState,
  ) {
    super(detail);
    this.name = 'ApiProblem';
  }

  static from(error: unknown): ApiProblem {
    if (error instanceof ApiProblem) return error;
    if (!(error instanceof HttpErrorResponse)) {
      return new ApiProblem(0, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
    }
    if (error.status === 0) {
      return new ApiProblem(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection.");
    }
    if (isProblem(error.error)) {
      const body = error.error;
      return new ApiProblem(body.status, body.code, body.detail ?? body.title, body.auction);
    }
    return new ApiProblem(error.status, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
  }
}

function isProblem(body: unknown): body is Problem {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Problem).code === 'string' &&
    typeof (body as Problem).title === 'string'
  );
}
