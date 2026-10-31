import { describe, expect, it } from 'vitest';
import type { AuctionFacts } from './auction.js';
import { evaluateBid, evaluateBuyNow, type BidAttempt } from './bid-rules.js';

const START = Date.parse('2026-10-31T12:00:00Z');
const END = START + 3 * 60 * 60 * 1000;
const LIVE = START + 1000;
const BUYER = 'demo-buyer';

function facts(overrides: Partial<AuctionFacts> = {}): AuctionFacts {
  return {
    startingBid: 14_500,
    reservePrice: 25_000,
    buyNowPrice: null,
    currentBid: 22_800,
    bidCount: 16,
    highBidderId: null,
    auctionStart: START,
    auctionEnd: END,
    buyNowBuyerId: null,
    ...overrides,
  };
}

function attempt(overrides: Partial<BidAttempt> = {}): BidAttempt {
  return { bidderId: BUYER, amount: 23_050, expectedCurrentBid: 22_800, ...overrides };
}

describe('evaluateBid', () => {
  it('accepts a bid at the minimum next bid', () => {
    expect(evaluateBid(facts(), attempt({ amount: 23_050 }), LIVE)).toEqual({ accepted: true });
  });

  it('accepts a bid above the minimum', () => {
    expect(evaluateBid(facts(), attempt({ amount: 30_000 }), LIVE)).toEqual({ accepted: true });
  });

  it('accepts a first bid at the starting bid', () => {
    const noBids = facts({ currentBid: null, bidCount: 0 });
    expect(
      evaluateBid(noBids, attempt({ amount: 14_500, expectedCurrentBid: null }), LIVE),
    ).toEqual({ accepted: true });
  });

  it('rejects a first bid below the starting bid', () => {
    const noBids = facts({ currentBid: null, bidCount: 0 });
    expect(
      evaluateBid(noBids, attempt({ amount: 14_400, expectedCurrentBid: null }), LIVE),
    ).toEqual({ accepted: false, code: 'BID_TOO_LOW' });
  });

  it('rejects a bid below the minimum increment', () => {
    expect(evaluateBid(facts(), attempt({ amount: 23_049 }), LIVE)).toEqual({
      accepted: false,
      code: 'BID_TOO_LOW',
    });
  });

  it('rejects a bid equal to the current bid', () => {
    expect(evaluateBid(facts(), attempt({ amount: 22_800 }), LIVE)).toEqual({
      accepted: false,
      code: 'BID_TOO_LOW',
    });
  });

  it('accepts exactly $1,000,000 and rejects anything above it', () => {
    expect(evaluateBid(facts(), attempt({ amount: 1_000_000 }), LIVE)).toEqual({ accepted: true });
    expect(evaluateBid(facts(), attempt({ amount: 1_000_001 }), LIVE)).toEqual({
      accepted: false,
      code: 'BID_TOO_HIGH',
    });
  });

  it('rejects bids before the auction starts and from the moment it ends', () => {
    expect(evaluateBid(facts(), attempt(), START - 1)).toEqual({
      accepted: false,
      code: 'AUCTION_NOT_LIVE',
    });
    expect(evaluateBid(facts(), attempt(), END)).toEqual({
      accepted: false,
      code: 'AUCTION_NOT_LIVE',
    });
  });

  it('rejects bids after a Buy Now purchase', () => {
    expect(evaluateBid(facts({ buyNowBuyerId: 'someone' }), attempt(), LIVE)).toEqual({
      accepted: false,
      code: 'AUCTION_NOT_LIVE',
    });
  });

  it('rejects a bid confirmed against a price that has since changed, even if it clears the new minimum', () => {
    const moved = facts({ currentBid: 23_050, bidCount: 17 });
    expect(
      evaluateBid(moved, attempt({ amount: 40_000, expectedCurrentBid: 22_800 }), LIVE),
    ).toEqual({ accepted: false, code: 'PRICE_CHANGED' });
  });

  it('treats a first bid placed after someone else bid as a price change', () => {
    expect(evaluateBid(facts(), attempt({ expectedCurrentBid: null }), LIVE)).toEqual({
      accepted: false,
      code: 'PRICE_CHANGED',
    });
  });

  it('rejects a bid from the current high bidder', () => {
    expect(evaluateBid(facts({ highBidderId: BUYER }), attempt(), LIVE)).toEqual({
      accepted: false,
      code: 'ALREADY_HIGH_BIDDER',
    });
  });

  describe('check order (the first failure wins)', () => {
    it('reports BID_TOO_HIGH before AUCTION_NOT_LIVE', () => {
      expect(evaluateBid(facts(), attempt({ amount: 2_000_000 }), END)).toMatchObject({
        code: 'BID_TOO_HIGH',
      });
    });

    it('reports AUCTION_NOT_LIVE before PRICE_CHANGED', () => {
      expect(evaluateBid(facts(), attempt({ expectedCurrentBid: 1 }), END)).toMatchObject({
        code: 'AUCTION_NOT_LIVE',
      });
    });

    it('reports PRICE_CHANGED before ALREADY_HIGH_BIDDER', () => {
      const state = facts({ highBidderId: BUYER });
      expect(evaluateBid(state, attempt({ expectedCurrentBid: 1 }), LIVE)).toMatchObject({
        code: 'PRICE_CHANGED',
      });
    });

    it('reports ALREADY_HIGH_BIDDER before BID_TOO_LOW', () => {
      const state = facts({ highBidderId: BUYER });
      expect(evaluateBid(state, attempt({ amount: 1 }), LIVE)).toMatchObject({
        code: 'ALREADY_HIGH_BIDDER',
      });
    });
  });
});

describe('evaluateBuyNow', () => {
  const offered = (overrides: Partial<AuctionFacts> = {}) =>
    facts({ buyNowPrice: 30_000, currentBid: 22_800, ...overrides });

  it('accepts while live and bidding is below the Buy Now price', () => {
    expect(evaluateBuyNow(offered(), LIVE)).toEqual({ accepted: true });
    expect(evaluateBuyNow(offered({ currentBid: null, bidCount: 0 }), LIVE)).toEqual({
      accepted: true,
    });
  });

  it('rejects before the auction opens and once it has ended', () => {
    expect(evaluateBuyNow(offered(), START - 1)).toEqual({
      accepted: false,
      code: 'AUCTION_NOT_LIVE',
    });
    expect(evaluateBuyNow(offered(), END)).toEqual({ accepted: false, code: 'AUCTION_NOT_LIVE' });
  });

  it('rejects a vehicle that was already bought', () => {
    expect(evaluateBuyNow(offered({ buyNowBuyerId: 'someone' }), LIVE)).toEqual({
      accepted: false,
      code: 'AUCTION_NOT_LIVE',
    });
  });

  it('rejects a vehicle with no Buy Now price', () => {
    expect(evaluateBuyNow(offered({ buyNowPrice: null }), LIVE)).toEqual({
      accepted: false,
      code: 'BUY_NOW_UNAVAILABLE',
    });
  });

  it('withdraws Buy Now once bidding reaches the Buy Now price', () => {
    expect(evaluateBuyNow(offered({ currentBid: 29_999 }), LIVE)).toEqual({ accepted: true });
    expect(evaluateBuyNow(offered({ currentBid: 30_000 }), LIVE)).toEqual({
      accepted: false,
      code: 'BUY_NOW_UNAVAILABLE',
    });
  });
});
