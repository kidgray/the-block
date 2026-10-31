import type { AuctionOutcome, AuctionStatus, ReserveStatus } from '@the-block/shared';

/** The stored facts about one vehicle's auction that every rule is derived from. */
export interface AuctionFacts {
  startingBid: number;
  reservePrice: number | null;
  buyNowPrice: number | null;
  currentBid: number | null;
  bidCount: number;
  highBidderId: string | null;
  auctionStart: number;
  auctionEnd: number;
  buyNowBuyerId: string | null;
}

/** Design §8.4: upcoming before the start, live until the end, ended at the end or on a Buy Now purchase. */
export function auctionStatus(facts: AuctionFacts, now: number): AuctionStatus {
  if (facts.buyNowBuyerId !== null || now >= facts.auctionEnd) return 'ended';
  if (now < facts.auctionStart) return 'upcoming';
  return 'live';
}

/** Design §8.2 / D11: increments scale with the current price. */
export function bidIncrement(price: number): number {
  if (price < 10_000) return 100;
  if (price < 30_000) return 250;
  return 500;
}

export function minNextBid(facts: AuctionFacts): number {
  return facts.currentBid === null
    ? facts.startingBid
    : facts.currentBid + bidIncrement(facts.currentBid);
}

export function reserveStatus(facts: AuctionFacts): ReserveStatus {
  if (facts.reservePrice === null) return 'none';
  return facts.currentBid !== null && facts.currentBid >= facts.reservePrice ? 'met' : 'not_met';
}

/** Design §11.3: the outcome is derived from stored state and the clock, never stored. */
export function auctionOutcome(facts: AuctionFacts, now: number): AuctionOutcome | null {
  if (facts.buyNowBuyerId !== null) return 'sold_buy_now';
  if (now < facts.auctionEnd) return null;
  if (facts.bidCount === 0) return 'no_sale';
  return reserveStatus(facts) === 'not_met' ? 'reserve_not_met' : 'sold';
}

/** Design §8.5: offered while live and while bidding is still below the Buy Now price. */
export function buyNowAvailable(facts: AuctionFacts, now: number): boolean {
  return (
    facts.buyNowPrice !== null &&
    auctionStatus(facts, now) === 'live' &&
    (facts.currentBid === null || facts.currentBid < facts.buyNowPrice)
  );
}

/** Where the auction stands: the Buy Now price once bought outright, else the current or starting bid. */
export function auctionPrice(facts: AuctionFacts): number {
  if (facts.buyNowBuyerId !== null && facts.buyNowPrice !== null) return facts.buyNowPrice;
  return facts.currentBid ?? facts.startingBid;
}
