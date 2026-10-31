import { TestBed } from '@angular/core/testing';
import type { AuctionState, User } from '@the-block/shared';
import { BehaviorSubject, defer, firstValueFrom, NEVER, of, Subject, throwError } from 'rxjs';
import { auctionState, vehicleDetail } from '../../testing/fixtures';
import { VehiclesApi } from '../core/api/vehicles-api';
import { SessionService } from '../core/session/session.service';
import { AuctionStateService } from './auction-state.service';

describe('AuctionStateService', () => {
  let service: AuctionStateService;
  let get: ReturnType<typeof vi.fn>;
  let auctionEvents: ReturnType<typeof vi.fn>;
  let user$: BehaviorSubject<User | null>;

  beforeEach(() => {
    get = vi.fn();
    auctionEvents = vi.fn(() => NEVER);
    user$ = new BehaviorSubject<User | null>(null);
    TestBed.configureTestingModule({
      providers: [
        AuctionStateService,
        { provide: VehiclesApi, useValue: { get, auctionEvents } },
        { provide: SessionService, useValue: { user$ } },
      ],
    });
    service = TestBed.inject(AuctionStateService);
  });

  it('ignores a snapshot older than the one it has', () => {
    service.load('v1', auctionState({ version: 2, currentBid: 6_000, bidCount: 1 }));
    service.apply(auctionState({ version: 1, currentBid: 5_500, bidCount: 1 }));
    expect(service.snapshot).toMatchObject({ version: 2, currentBid: 6_000 });
  });

  it('applies a snapshot of the same or a newer version', () => {
    service.load('v1', auctionState({ version: 2 }));

    service.apply(
      auctionState({ version: 2, viewer: { isHighBidder: true, hasBid: true, purchased: false } }),
    );
    expect(service.snapshot?.viewer?.isHighBidder).toBe(true);

    service.apply(auctionState({ version: 3, currentBid: 6_000, bidCount: 1 }));
    expect(service.snapshot).toMatchObject({ version: 3, currentBid: 6_000 });
  });

  it('reloads the latest state from the API', async () => {
    get.mockReturnValue(of(vehicleDetail({ auction: auctionState({ version: 5 }) })));
    service.load('v1', auctionState({ version: 4 }));

    const reloaded = await firstValueFrom(service.reload());

    expect(get).toHaveBeenCalledWith('v1');
    expect(reloaded?.version).toBe(5);
    expect(service.snapshot?.version).toBe(5);
  });

  it('reloads to null, keeping its state, when the API fails', async () => {
    get.mockReturnValue(throwError(() => new Error('offline')));
    service.load('v1', auctionState({ version: 4 }));

    expect(await firstValueFrom(service.reload())).toBeNull();
    expect(service.snapshot?.version).toBe(4);
  });

  describe('live updates', () => {
    let stream: Subject<AuctionState>;

    beforeEach(() => {
      stream = new Subject<AuctionState>();
      // Cold, like the real stream: every subscription opens a new connection.
      auctionEvents.mockImplementation(() => defer(() => stream));
      get.mockReturnValue(NEVER);
    });

    it('opens the vehicle stream and applies its snapshots, ignoring older ones', () => {
      service.load('v1', auctionState({ version: 1 }));
      expect(auctionEvents).toHaveBeenCalledWith('v1');

      stream.next(auctionState({ version: 2, currentBid: 6_000, bidCount: 1 }));
      expect(service.snapshot).toMatchObject({ version: 2, currentBid: 6_000 });

      stream.next(auctionState({ version: 1, currentBid: 5_500, bidCount: 1 }));
      expect(service.snapshot?.version).toBe(2);
    });

    it('applies a status change, which keeps the version', () => {
      service.load('v1', auctionState({ version: 3 }));
      stream.next(
        auctionState({ version: 3, status: 'ended', minNextBid: null, outcome: 'no_sale' }),
      );
      expect(service.snapshot).toMatchObject({ status: 'ended', outcome: 'no_sale' });
    });

    it('reopens the stream when the buyer signs in, since payloads are per viewer', () => {
      service.load('v1', auctionState());
      expect(stream.observed).toBe(true);
      const firstStream = stream;

      stream = new Subject<AuctionState>();
      user$.next({ id: 'demo-buyer', displayName: 'Demo Buyer' });

      expect(auctionEvents).toHaveBeenCalledTimes(2);
      expect(firstStream.observed).toBe(false);
      expect(stream.observed).toBe(true);
    });

    it('retries a refused stream with backoff', () => {
      vi.useFakeTimers();
      try {
        service.load('v1', auctionState());
        stream.error(new Error('refused'));
        stream = new Subject<AuctionState>();

        vi.advanceTimersByTime(999);
        expect(stream.observed).toBe(false);
        vi.advanceTimersByTime(1);
        expect(stream.observed).toBe(true);

        stream.next(auctionState({ version: 4 }));
        expect(service.snapshot?.version).toBe(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it('closes the stream when the page is destroyed', () => {
      service.load('v1', auctionState());
      TestBed.resetTestingModule();
      expect(stream.observed).toBe(false);
    });
  });
});
