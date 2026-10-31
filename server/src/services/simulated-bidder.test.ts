import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuctionClock } from '../clock.js';
import { openDatabase, type Db } from '../db/connection.js';
import { DEMO_BUYER_ID, resetDatabase, SIMULATED_BIDDER_ID } from '../db/seed.js';
import { AuctionEvents, type AuctionEvent } from '../events/auction-events.js';
import { BidRepository } from '../repositories/bid-repository.js';
import { IdempotencyRepository } from '../repositories/idempotency-repository.js';
import { VehicleRepository } from '../repositories/vehicle-repository.js';
import { datasetVehicle, HOUR_MS, NOW } from '../testing/api-test-kit.js';
import { BidService } from './bid-service.js';
import { SimulatedBidder, type SimulatedBidderOptions } from './simulated-bidder.js';

const BUYER = { id: DEMO_BUYER_ID, displayName: 'Demo Buyer' };
const RIVAL = { id: SIMULATED_BIDDER_ID, displayName: 'Another bidder' };
const silent = pino({ level: 'silent' });

/** A real BidService on an in-memory database, with the simulator listening to it. */
function harness(options: Partial<SimulatedBidderOptions> = {}) {
  let now = NOW;
  const db: Db = openDatabase(':memory:');
  resetDatabase(
    db,
    [
      // Reserve $25,000, current bid $22,800 (minimum next bid $23,050).
      datasetVehicle(),
      datasetVehicle({ id: 'buy-now-1', lot: 'A-0002', buy_now_price: 30_000 }),
    ],
    now,
  );
  db.prepare('UPDATE vehicles SET auction_start = ?, auction_end = ?').run(
    now - HOUR_MS,
    now + 2 * HOUR_MS,
  );

  const clock = new AuctionClock(() => now);
  const events = new AuctionEvents();
  const vehicles = new VehicleRepository(db);
  const bids = new BidService(
    db,
    vehicles,
    new BidRepository(db),
    new IdempotencyRepository(db),
    clock,
    events,
  );
  const simulator = new SimulatedBidder(RIVAL, bids, vehicles, events, clock, silent, {
    seed: 'test-seed',
    delayMs: { min: 3_000, max: 3_000 },
    ceilingBand: { min: 0.1, max: 0.1 },
    ...options,
  });
  const published: AuctionEvent[] = [];
  events.subscribe((event) => published.push(event));
  simulator.start();

  return {
    db,
    events,
    simulator,
    published,
    vehicle: (id = 'live-1') => vehicles.findById(id)!,
    setNow: (time: number) => (now = time),
    buyerBids: (amount: number, vehicleId = 'live-1') => {
      const current = vehicles.findById(vehicleId)!.currentBid;
      return bids.placeBid({
        user: BUYER,
        vehicleId,
        request: { amount, expectedCurrentBid: current },
        idempotencyKey: crypto.randomUUID(),
        log: silent,
      });
    },
    buyNow: (vehicleId: string) =>
      bids.buyNow({ user: BUYER, vehicleId, idempotencyKey: crypto.randomUUID(), log: silent }),
  };
}

describe('SimulatedBidder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counter-bids the minimum next bid after the delay, through BidService', () => {
    const sim = harness();
    expect(sim.buyerBids(23_050).status).toBe(201);

    vi.advanceTimersByTime(2_999);
    expect(sim.vehicle().highBidderId).toBe(DEMO_BUYER_ID);

    vi.advanceTimersByTime(1);
    const vehicle = sim.vehicle();
    expect(vehicle.highBidderId).toBe(SIMULATED_BIDDER_ID);
    expect(vehicle.currentBid).toBe(23_300);
    expect(vehicle.bidCount).toBe(18);
    // The counter-bid went through the bid service: it was stored and published like any bid.
    expect(
      sim.db.prepare('SELECT COUNT(*) FROM bids WHERE user_id = ?').pluck().get(RIVAL.id),
    ).toBe(1);
    expect(sim.published.at(-1)).toEqual({
      type: 'bid_accepted',
      vehicleId: 'live-1',
      bidderId: SIMULATED_BIDDER_ID,
      amount: 23_300,
    });
  });

  it('never answers its own bids', () => {
    const sim = harness();
    sim.buyerBids(23_050);
    vi.advanceTimersByTime(3_000);
    expect(sim.simulator.pendingCount).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(sim.vehicle().bidCount).toBe(18);
  });

  it('picks each delay from the configured range, reproducibly for a seed', () => {
    const delays = (seed: string) => {
      const sim = harness({ seed, delayMs: { min: 3_000, max: 10_000 } });
      const observed: number[] = [];
      for (let round = 0; round < 3; round++) {
        sim.buyerBids(sim.vehicle().currentBid! + 1_000);
        let waited = 0;
        while (sim.vehicle().highBidderId === DEMO_BUYER_ID) {
          vi.advanceTimersByTime(100);
          waited += 100;
        }
        observed.push(waited);
      }
      return observed;
    };

    const first = delays('seed-a');
    for (const delay of first) {
      expect(delay).toBeGreaterThanOrEqual(3_000);
      expect(delay).toBeLessThanOrEqual(10_000);
    }
    expect(delays('seed-a')).toEqual(first);
  });

  it('skips the counter-bid when the auction has ended meanwhile', () => {
    const sim = harness();
    sim.buyerBids(23_050);
    sim.setNow(NOW + 3 * HOUR_MS);
    vi.advanceTimersByTime(3_000);
    expect(sim.vehicle().highBidderId).toBe(DEMO_BUYER_ID);
  });

  it('skips the counter-bid when the buyer has already been outbid', () => {
    const sim = harness();
    sim.buyerBids(23_050);
    sim.simulator.bidNow('live-1');
    expect(sim.vehicle().bidCount).toBe(18);

    vi.advanceTimersByTime(3_000);
    expect(sim.vehicle().bidCount).toBe(18);
  });

  it('stops at its ceiling, so the buyer can win', () => {
    // A 10% band above the $25,000 reserve: the ceiling is $27,500.
    const sim = harness();
    expect(sim.simulator.ceilingFor('live-1', sim.vehicle())).toBe(27_500);

    sim.buyerBids(27_000); // minimum next bid becomes $27,250: within the ceiling
    vi.advanceTimersByTime(3_000);
    expect(sim.vehicle()).toMatchObject({ highBidderId: SIMULATED_BIDDER_ID, currentBid: 27_250 });

    sim.buyerBids(27_500); // minimum next bid becomes $28,000: above the ceiling
    vi.advanceTimersByTime(3_000);
    expect(sim.vehicle()).toMatchObject({ highBidderId: DEMO_BUYER_ID, currentBid: 27_500 });
  });

  it('draws ceilings above the current bid when there is no reserve, reproducibly', () => {
    const sim = harness({ ceilingBand: { min: 0.02, max: 0.15 } });
    const facts = { ...sim.vehicle(), reservePrice: null };
    const ceiling = sim.simulator.ceilingFor('no-reserve', facts);
    expect(ceiling).toBeGreaterThanOrEqual(Math.round(22_800 * 1.02));
    expect(ceiling).toBeLessThanOrEqual(Math.round(22_800 * 1.15));
    expect(
      harness({ ceilingBand: { min: 0.02, max: 0.15 } }).simulator.ceilingFor('no-reserve', facts),
    ).toBe(ceiling);
  });

  it('cancels its pending counter-bid when the buyer uses Buy Now', () => {
    const sim = harness();
    sim.buyerBids(23_050, 'buy-now-1');
    expect(sim.simulator.pendingCount).toBe(1);

    expect(sim.buyNow('buy-now-1').status).toBe(201);
    expect(sim.simulator.pendingCount).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(sim.vehicle('buy-now-1').highBidderId).toBe(DEMO_BUYER_ID);
  });

  it('cancels its pending counter-bid when the auction ends', () => {
    const sim = harness();
    sim.buyerBids(23_050);
    sim.events.publish({ type: 'status_changed', vehicleId: 'live-1', status: 'ended' });
    expect(sim.simulator.pendingCount).toBe(0);
  });

  it('bids at once, ignoring the ceiling, when overridden', () => {
    const sim = harness({ ceilingBand: { min: 0, max: 0 } });
    sim.buyerBids(25_000); // already at the $25,000 ceiling
    const result = sim.simulator.bidNow('live-1');
    expect(result?.status).toBe(201);
    expect(sim.vehicle()).toMatchObject({ highBidderId: SIMULATED_BIDDER_ID, currentBid: 25_250 });
  });

  it('stops reacting once stopped', () => {
    const sim = harness();
    sim.simulator.stop();
    sim.buyerBids(23_050);
    vi.advanceTimersByTime(10_000);
    expect(sim.vehicle().highBidderId).toBe(DEMO_BUYER_ID);
  });
});
