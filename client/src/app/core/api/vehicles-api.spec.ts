import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AuctionState } from '@the-block/shared';
import { auctionState } from '../../../testing/fixtures';
import { EVENT_SOURCE } from '../http/event-source';
import { ServerClock } from '../time/server-clock';
import { VehiclesApi } from './vehicles-api';

/** Just enough of EventSource to drive the wrapper. */
class FakeEventSource {
  readyState = 1;
  closed = false;
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }
}

describe('VehiclesApi.auctionEvents', () => {
  let api: VehiclesApi;
  let sources: FakeEventSource[];

  beforeEach(() => {
    sources = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: EVENT_SOURCE,
          useValue: (url: string) => {
            const source = new FakeEventSource(url);
            sources.push(source);
            return source as unknown as EventSource;
          },
        },
      ],
    });
    api = TestBed.inject(VehiclesApi);
  });

  it("opens the vehicle's stream and emits each auction snapshot, syncing the clock", () => {
    const sync = vi.spyOn(TestBed.inject(ServerClock), 'sync');
    const received: AuctionState[] = [];
    api.auctionEvents('v 1').subscribe((state) => received.push(state));

    expect(sources[0]?.url).toBe('/api/vehicles/v%201/events');
    const snapshot = auctionState({ version: 3, serverTime: '2026-10-31T15:00:00.000Z' });
    sources[0]!.emit('auction', new MessageEvent('auction', { data: JSON.stringify(snapshot) }));

    expect(received).toEqual([snapshot]);
    expect(sync).toHaveBeenCalledWith('2026-10-31T15:00:00.000Z');
  });

  it('lets the browser reconnect a dropped stream, and errors only when it is refused', () => {
    const error = vi.fn();
    api.auctionEvents('v1').subscribe({ error });

    sources[0]!.readyState = 0; // CONNECTING: the browser is retrying by itself
    sources[0]!.emit('error', new Event('error'));
    expect(error).not.toHaveBeenCalled();

    sources[0]!.readyState = 2; // CLOSED: refused, e.g. a 404
    sources[0]!.emit('error', new Event('error'));
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('closes the connection on unsubscribe', () => {
    const subscription = api.auctionEvents('v1').subscribe();
    subscription.unsubscribe();
    expect(sources[0]?.closed).toBe(true);
  });
});
