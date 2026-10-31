import type { Problem, ProblemCode } from '@the-block/shared';

const TITLES: Record<ProblemCode, string> = {
  INVALID_JSON: 'The request body is not valid JSON',
  PAYLOAD_TOO_LARGE: 'The request body is too large',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported content type',
  VALIDATION_FAILED: 'The request is invalid',
  NOT_FOUND: 'Not found',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  AUTH_REQUIRED: 'Sign-in required',
  IDEMPOTENCY_KEY_REQUIRED: 'Idempotency key required',
  IDEMPOTENCY_KEY_REUSED: 'Idempotency key already used',
  AUCTION_NOT_LIVE: 'The auction is not accepting bids',
  PRICE_CHANGED: 'The price changed before your bid was placed',
  ALREADY_HIGH_BIDDER: 'You are already the high bidder',
  BID_TOO_LOW: 'The bid is below the minimum',
  BID_TOO_HIGH: 'The bid is above the maximum',
  BUY_NOW_UNAVAILABLE: 'Buy Now is not available',
  INTERNAL_ERROR: 'Something went wrong',
};

/** Builds an RFC 9457 Problem Details body (design §12.1). */
export function problem(
  status: number,
  code: ProblemCode,
  detail?: string,
  extras: Pick<Problem, 'auction' | 'errors'> = {},
): Problem {
  return {
    type: `https://the-block.example/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title: TITLES[code],
    status,
    ...(detail !== undefined && { detail }),
    code,
    ...extras,
  };
}

export class ProblemError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.title);
    this.name = 'ProblemError';
  }
}

export function problemError(
  status: number,
  code: ProblemCode,
  detail?: string,
  extras?: Pick<Problem, 'auction' | 'errors'>,
): ProblemError {
  return new ProblemError(problem(status, code, detail, extras));
}
