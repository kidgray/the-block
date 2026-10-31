import type { AuctionStatus } from '@the-block/shared';

/** Something changed one vehicle's auction state (design §6.1). Listeners build their own snapshots. */
export type AuctionEvent =
  | { type: 'bid_accepted'; vehicleId: string; bidderId: string; amount: number }
  | { type: 'bought'; vehicleId: string; buyerId: string }
  | { type: 'status_changed'; vehicleId: string; status: AuctionStatus };

export type AuctionEventListener = (event: AuctionEvent) => void;

/**
 * In-process publish/subscribe for auction state changes (design §6.3). It feeds the SSE streams
 * and the simulated bidder. Publishers call it only after the change has been committed.
 */
export class AuctionEvents {
  private readonly listeners = new Set<AuctionEventListener>();

  constructor(private readonly onListenerError?: (error: unknown, event: AuctionEvent) => void) {}

  /** Returns a function that removes the listener. */
  subscribe(listener: AuctionEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** A failing listener never stops the others, or the request that published the event. */
  publish(event: AuctionEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        this.onListenerError?.(error, event);
      }
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
