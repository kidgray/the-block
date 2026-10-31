import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuctionClock } from '../clock.js';
import { openDatabase } from '../db/connection.js';
import { DEMO_BUYER_ID, resetDatabase } from '../db/seed.js';
import { AuctionEvents, type AuctionEvent } from '../events/auction-events.js';
import { VehicleRepository } from '../repositories/vehicle-repository.js';
import { datasetVehicle, HOUR_MS, NOW } from '../testing/api-test-kit.js';
import { AuctionStatusWatcher } from './auction-status-watcher.js';

const MINUTE_MS = 60_000;

describe('AuctionStatusWatcher', () => {
  let published: AuctionEvent[];
  let watcher: AuctionStatusWatcher;
  let db: ReturnType<typeof openDatabase>;

  const setWindow = (id: string, start: number, end: number) =>
    db
      .prepare('UPDATE vehicles SET auction_start = ?, auction_end = ? WHERE id = ?')
      .run(start, end, id);

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    db = openDatabase(':memory:');
    resetDatabase(
      db,
      [
        datasetVehicle({ id: 'starts-soon', lot: 'A-1' }),
        datasetVehicle({ id: 'ends-soon', lot: 'A-2' }),
        datasetVehicle({ id: 'bought', lot: 'A-3' }),
      ],
      NOW,
    );
    setWindow('starts-soon', NOW + 5 * MINUTE_MS, NOW + 3 * HOUR_MS);
    setWindow('ends-soon', NOW - HOUR_MS, NOW + 10 * MINUTE_MS);
    setWindow('bought', NOW - HOUR_MS, NOW + 7 * MINUTE_MS);
    db.prepare('UPDATE vehicles SET buy_now_buyer_id = ? WHERE id = ?').run(
      DEMO_BUYER_ID,
      'bought',
    );

    const events = new AuctionEvents();
    published = [];
    events.subscribe((event) => published.push(event));
    // AuctionClock reads Date.now, which the fake timers control.
    watcher = new AuctionStatusWatcher(new VehicleRepository(db), new AuctionClock(), events);
    watcher.start();
  });

  afterEach(() => {
    watcher.stop();
    vi.useRealTimers();
  });

  it('announces an auction going live at its start time', () => {
    vi.advanceTimersByTime(5 * MINUTE_MS - 1);
    expect(published).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(published).toEqual([
      { type: 'status_changed', vehicleId: 'starts-soon', status: 'live' },
    ]);
  });

  it('announces an auction ending at its end time, and skips vehicles already bought', () => {
    vi.advanceTimersByTime(10 * MINUTE_MS);
    expect(published).toEqual([
      { type: 'status_changed', vehicleId: 'starts-soon', status: 'live' },
      { type: 'status_changed', vehicleId: 'ends-soon', status: 'ended' },
    ]);
  });

  it('keeps going until the last auction ends', () => {
    vi.advanceTimersByTime(4 * HOUR_MS);
    expect(published.map((event) => event.vehicleId)).toEqual([
      'starts-soon',
      'ends-soon',
      'starts-soon',
    ]);
    expect(published.at(-1)).toMatchObject({ status: 'ended' });
  });

  it('stops announcing once stopped', () => {
    watcher.stop();
    vi.advanceTimersByTime(HOUR_MS);
    expect(published).toEqual([]);
  });
});
