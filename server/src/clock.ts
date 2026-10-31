/**
 * The single source of "now" for auction rules (design §6.3). Injectable so tests control time.
 */
export class AuctionClock {
  constructor(private readonly nowFn: () => number = Date.now) {}

  now(): number {
    return this.nowFn();
  }
}
