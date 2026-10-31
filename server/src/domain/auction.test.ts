import { describe, expect, it } from 'vitest';
import {
  auctionPrice,
  auctionOutcome,
  auctionStatus,
  bidIncrement,
  buyNowAvailable,
  minNextBid,
  reserveStatus,
  type AuctionFacts,
} from './auction.js';

const START = Date.parse('2026-10-31T12:00:00Z');
const END = START + 3 * 60 * 60 * 1000;
const LIVE = START + 1000;

function facts(overrides: Partial<AuctionFacts> = {}): AuctionFacts {
  return {
    startingBid: 14_500,
    reservePrice: 25_000,
    buyNowPrice: null,
    currentBid: null,
    bidCount: 0,
    highBidderId: null,
    auctionStart: START,
    auctionEnd: END,
    buyNowBuyerId: null,
    ...overrides,
  };
}

describe('auctionStatus', () => {
  it('is upcoming before the start', () => {
    expect(auctionStatus(facts(), START - 1)).toBe('upcoming');
  });

  it('is live from the exact start time', () => {
    expect(auctionStatus(facts(), START)).toBe('live');
  });

  it('is live until just before the end', () => {
    expect(auctionStatus(facts(), END - 1)).toBe('live');
  });

  it('is ended from the exact end time', () => {
    expect(auctionStatus(facts(), END)).toBe('ended');
  });

  it('is ended as soon as the vehicle is bought through Buy Now', () => {
    expect(auctionStatus(facts({ buyNowBuyerId: 'demo-buyer' }), LIVE)).toBe('ended');
  });
});

describe('bidIncrement', () => {
  it.each([
    [0, 100],
    [9_999, 100],
    [10_000, 250],
    [29_999, 250],
    [30_000, 500],
    [77_000, 500],
  ])('is %i → $%i', (price, increment) => {
    expect(bidIncrement(price)).toBe(increment);
  });
});

describe('minNextBid', () => {
  it('is the starting bid when there are no bids', () => {
    expect(minNextBid(facts({ startingBid: 14_500 }))).toBe(14_500);
  });

  it('adds the increment for the current tier', () => {
    expect(minNextBid(facts({ currentBid: 9_900, bidCount: 3 }))).toBe(10_000);
    expect(minNextBid(facts({ currentBid: 10_000, bidCount: 3 }))).toBe(10_250);
    expect(minNextBid(facts({ currentBid: 30_000, bidCount: 3 }))).toBe(30_500);
  });
});

describe('reserveStatus', () => {
  it('is none without a reserve', () => {
    expect(reserveStatus(facts({ reservePrice: null }))).toBe('none');
  });

  it('is not_met with no bids or a bid below the reserve', () => {
    expect(reserveStatus(facts())).toBe('not_met');
    expect(reserveStatus(facts({ currentBid: 24_999, bidCount: 1 }))).toBe('not_met');
  });

  it('is met at the reserve', () => {
    expect(reserveStatus(facts({ currentBid: 25_000, bidCount: 1 }))).toBe('met');
  });
});

describe('auctionOutcome', () => {
  it('is null before the end', () => {
    expect(auctionOutcome(facts({ currentBid: 30_000, bidCount: 4 }), LIVE)).toBeNull();
  });

  it('is sold_buy_now after a Buy Now purchase, even before the scheduled end', () => {
    expect(auctionOutcome(facts({ buyNowBuyerId: 'demo-buyer' }), LIVE)).toBe('sold_buy_now');
  });

  it('is no_sale when the auction ends without bids', () => {
    expect(auctionOutcome(facts(), END)).toBe('no_sale');
  });

  it('is sold when the reserve is met', () => {
    expect(auctionOutcome(facts({ currentBid: 25_000, bidCount: 5 }), END)).toBe('sold');
  });

  it('is sold with any bid when there is no reserve', () => {
    expect(auctionOutcome(facts({ reservePrice: null, currentBid: 3_000, bidCount: 1 }), END)).toBe(
      'sold',
    );
  });

  it('is reserve_not_met when bidding stays below the reserve', () => {
    expect(auctionOutcome(facts({ currentBid: 20_000, bidCount: 5 }), END)).toBe('reserve_not_met');
  });
});

describe('buyNowAvailable', () => {
  const withBuyNow = (overrides: Partial<AuctionFacts> = {}) =>
    facts({ buyNowPrice: 40_000, ...overrides });

  it('is false without a Buy Now price', () => {
    expect(buyNowAvailable(facts(), LIVE)).toBe(false);
  });

  it('is true while live and below the Buy Now price', () => {
    expect(buyNowAvailable(withBuyNow(), LIVE)).toBe(true);
    expect(buyNowAvailable(withBuyNow({ currentBid: 39_999, bidCount: 9 }), LIVE)).toBe(true);
  });

  it('is withdrawn once bidding reaches the Buy Now price', () => {
    expect(buyNowAvailable(withBuyNow({ currentBid: 40_000, bidCount: 9 }), LIVE)).toBe(false);
  });

  it('is false before the start and after the end', () => {
    expect(buyNowAvailable(withBuyNow(), START - 1)).toBe(false);
    expect(buyNowAvailable(withBuyNow(), END)).toBe(false);
  });
});

describe('auctionPrice', () => {
  it('is the starting bid before any bids, then the current bid', () => {
    expect(auctionPrice(facts({ currentBid: null, bidCount: 0, startingBid: 9_000 }))).toBe(9_000);
    expect(auctionPrice(facts({ currentBid: 12_000, bidCount: 3 }))).toBe(12_000);
  });

  it('is the Buy Now price once the vehicle is bought outright', () => {
    expect(
      auctionPrice(facts({ currentBid: 12_000, buyNowPrice: 20_000, buyNowBuyerId: 'demo-buyer' })),
    ).toBe(20_000);
  });
});
