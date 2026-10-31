import { MAX_BID_AMOUNT } from '@the-block/shared';
import { auctionStatus, buyNowAvailable, minNextBid, type AuctionFacts } from './auction.js';

export type BidRejectionCode =
  'BID_TOO_HIGH' | 'AUCTION_NOT_LIVE' | 'PRICE_CHANGED' | 'ALREADY_HIGH_BIDDER' | 'BID_TOO_LOW';

export interface BidAttempt {
  bidderId: string;
  amount: number;
  expectedCurrentBid: number | null;
}

export type BidEvaluation = { accepted: true } | { accepted: false; code: BidRejectionCode };

/**
 * Design §8.3. Request-shape validation (positive whole numbers) happens at the HTTP boundary;
 * the remaining checks run in this order and the first failure wins.
 */
export function evaluateBid(facts: AuctionFacts, attempt: BidAttempt, now: number): BidEvaluation {
  if (attempt.amount > MAX_BID_AMOUNT) return reject('BID_TOO_HIGH');
  if (auctionStatus(facts, now) !== 'live') return reject('AUCTION_NOT_LIVE');
  if (facts.currentBid !== attempt.expectedCurrentBid) return reject('PRICE_CHANGED');
  if (facts.highBidderId === attempt.bidderId) return reject('ALREADY_HIGH_BIDDER');
  if (attempt.amount < minNextBid(facts)) return reject('BID_TOO_LOW');
  return { accepted: true };
}

function reject(code: BidRejectionCode): BidEvaluation {
  return { accepted: false, code };
}

export type BuyNowRejectionCode = 'AUCTION_NOT_LIVE' | 'BUY_NOW_UNAVAILABLE';

export type BuyNowEvaluation = { accepted: true } | { accepted: false; code: BuyNowRejectionCode };

/**
 * Design §8.5. A vehicle already bought has ended, so it is rejected as AUCTION_NOT_LIVE; a live
 * auction without a Buy Now price, or with bidding at or above it, is BUY_NOW_UNAVAILABLE.
 */
export function evaluateBuyNow(facts: AuctionFacts, now: number): BuyNowEvaluation {
  if (auctionStatus(facts, now) !== 'live') return { accepted: false, code: 'AUCTION_NOT_LIVE' };
  if (!buyNowAvailable(facts, now)) return { accepted: false, code: 'BUY_NOW_UNAVAILABLE' };
  return { accepted: true };
}
