import type { Response } from 'express';
import type { AuctionState } from '@the-block/shared';
import type { AuctionEvents } from '../events/auction-events.js';

/** How often a comment line keeps idle proxies from closing the stream (design §6.1). */
export const KEEP_ALIVE_MS = 20_000;
/** How long the browser waits before reconnecting a dropped stream. */
const RECONNECT_DELAY_MS = 3_000;

export interface AuctionStreamOptions {
  vehicleId: string;
  events: AuctionEvents;
  /** The vehicle's auction as this viewer sees it. */
  snapshot: () => AuctionState;
  keepAliveMs?: number;
}

/**
 * Streams one vehicle's auction over Server-Sent Events (design §6.1). Every event is a complete
 * snapshot built for this connection's viewer, and the first is sent at once, so a reconnecting
 * client is correct after one event and nothing has to be replayed.
 */
export function streamAuction(res: Response, options: AuctionStreamOptions): void {
  const first = options.snapshot();
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Asks reverse proxies such as nginx not to buffer the stream.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`retry: ${RECONNECT_DELAY_MS}\n\n`);

  const send = (state: AuctionState) => {
    res.write(`event: auction\ndata: ${JSON.stringify(state)}\n\n`);
  };
  send(first);

  const unsubscribe = options.events.subscribe((event) => {
    if (event.vehicleId === options.vehicleId) send(options.snapshot());
  });
  const keepAlive = setInterval(
    () => res.write(': keep-alive\n\n'),
    options.keepAliveMs ?? KEEP_ALIVE_MS,
  );

  // The response closes when the client disconnects (closing the page, or a dropped network).
  res.on('close', () => {
    unsubscribe();
    clearInterval(keepAlive);
  });
}
