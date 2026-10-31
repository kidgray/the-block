import type { AuctionClock } from '../clock.js';
import type { AuctionEvents } from '../events/auction-events.js';
import type { VehicleRepository } from '../repositories/vehicle-repository.js';

/** Wake at least this often, so a long wait never drifts far from the clock (e.g., after a laptop sleeps). */
const MAX_WAIT_MS = 60_000;

/**
 * Publishes a `status_changed` event when an auction goes live or ends (design §8.4), so SSE
 * clients and the simulated bidder see it without polling. It sets one timer, for the next start
 * or end across all auctions, and announces every change in the window it just waited through.
 */
export class AuctionStatusWatcher {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private checkedUntil = 0;

  constructor(
    private readonly vehicles: VehicleRepository,
    private readonly clock: AuctionClock,
    private readonly events: AuctionEvents,
  ) {}

  start(): void {
    this.stop();
    this.checkedUntil = this.clock.now();
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNext(): void {
    const next = this.vehicles.nextStatusChangeAfter(this.checkedUntil);
    if (next === null) {
      this.timer = null;
      return;
    }
    const delay = Math.min(Math.max(0, next - this.clock.now()), MAX_WAIT_MS);
    this.timer = setTimeout(() => this.check(), delay);
    // A pending status check never keeps the process alive on shutdown.
    this.timer.unref?.();
  }

  private check(): void {
    const now = this.clock.now();
    for (const change of this.vehicles.statusChangesBetween(this.checkedUntil, now)) {
      this.events.publish({ type: 'status_changed', ...change });
    }
    this.checkedUntil = Math.max(this.checkedUntil, now);
    this.scheduleNext();
  }
}
