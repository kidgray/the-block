import type { MyBidStatus } from '@the-block/shared';
import { auctionOutcome, auctionStatus, type AuctionFacts } from './auction.js';

/**
 * The buyer's position in an auction they bid on or bought (design §7.5). Winning and outbid
 * belong to the Active tab; every other status belongs to the Ended tab.
 */
export function myBidStatus(facts: AuctionFacts, userId: string, now: number): MyBidStatus {
  if (facts.buyNowBuyerId === userId) return 'purchased';
  // Someone else bought it outright, so the auction ended as their sale whatever the bids were.
  if (facts.buyNowBuyerId !== null) return 'lost';
  const isHighBidder = facts.highBidderId === userId;
  if (auctionStatus(facts, now) !== 'ended') return isHighBidder ? 'winning' : 'outbid';
  if (!isHighBidder) return 'lost';
  return auctionOutcome(facts, now) === 'reserve_not_met' ? 'reserve_not_met' : 'won';
}

export function isActiveMyBidStatus(status: MyBidStatus): boolean {
  return status === 'winning' || status === 'outbid';
}
