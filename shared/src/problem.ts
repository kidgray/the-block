import type { AuctionState } from './auction.js';

/** Stable error codes carried in every Problem Details response (design §12). */
export const PROBLEM_CODES = [
  'INVALID_JSON',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'VEHICLE_NOT_FOUND',
  'AUTH_REQUIRED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'AUCTION_NOT_LIVE',
  'PRICE_CHANGED',
  'ALREADY_HIGH_BIDDER',
  'BID_TOO_LOW',
  'BID_TOO_HIGH',
  'BUY_NOW_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

export interface ValidationIssue {
  path: string;
  message: string;
}

/** RFC 9457 Problem Details with this API's extension members. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: ProblemCode;
  /** The latest auction state, on 409 responses. */
  auction?: AuctionState;
  /** Field-level issues, on VALIDATION_FAILED. */
  errors?: ValidationIssue[];
}
