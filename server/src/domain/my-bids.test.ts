import { describe, expect, it } from 'vitest';
import type { AuctionFacts } from './auction.js';
import { myBidStatus } from './my-bids.js';

const START = Date.parse('2026-10-31T12:00:00Z');
const END = START + 3 * 60 * 60 * 1000;
const LIVE = START + 1000;
const BUYER = 'demo-buyer';
const RIVAL = 'sim-bidder-1';

function facts(overrides: Partial<AuctionFacts> = {}): AuctionFacts {
  return {
    startingBid: 14_500,
    reservePrice: 25_000,
    buyNowPrice: 40_000,
    currentBid: 26_000,
    bidCount: 5,
    highBidderId: BUYER,
    auctionStart: START,
    auctionEnd: END,
    buyNowBuyerId: null,
    ...overrides,
  };
}

describe('myBidStatus', () => {
  it('is winning or outbid while the auction is live', () => {
    expect(myBidStatus(facts(), BUYER, LIVE)).toBe('winning');
    expect(myBidStatus(facts({ highBidderId: RIVAL }), BUYER, LIVE)).toBe('outbid');
  });

  it('is won when the auction ends as a sale to the buyer', () => {
    expect(myBidStatus(facts(), BUYER, END)).toBe('won');
    expect(myBidStatus(facts({ reservePrice: null }), BUYER, END)).toBe('won');
  });

  it('is reserve not met when the buyer was the high bidder below the reserve', () => {
    expect(myBidStatus(facts({ currentBid: 24_000 }), BUYER, END)).toBe('reserve_not_met');
  });

  it('is lost when someone else held the high bid at the end', () => {
    expect(myBidStatus(facts({ highBidderId: RIVAL }), BUYER, END)).toBe('lost');
    expect(myBidStatus(facts({ highBidderId: RIVAL, currentBid: 24_000 }), BUYER, END)).toBe(
      'lost',
    );
  });

  it('is lost when an earlier, unknown bidder held the high bid', () => {
    expect(myBidStatus(facts({ highBidderId: null }), BUYER, END)).toBe('lost');
  });

  it('is purchased when the buyer bought it through Buy Now', () => {
    expect(myBidStatus(facts({ buyNowBuyerId: BUYER, auctionEnd: LIVE }), BUYER, LIVE)).toBe(
      'purchased',
    );
  });

  it('is lost when someone else bought it through Buy Now', () => {
    expect(myBidStatus(facts({ buyNowBuyerId: RIVAL }), BUYER, LIVE)).toBe('lost');
  });
});
