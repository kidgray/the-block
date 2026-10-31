import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AuctionState } from '@the-block/shared';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  type Observable,
  of,
  retry,
  skip,
  switchMap,
  timer,
} from 'rxjs';
import { VehiclesApi } from '../core/api/vehicles-api';
import { SessionService } from '../core/session/session.service';
import { ServerClock } from '../core/time/server-clock';

/** Small delay after a start/end boundary so the server has certainly crossed it too. */
const BOUNDARY_GRACE_MS = 500;
/** Waits before reopening a refused stream: 1 s, 2 s, 4 s, … up to 30 s. */
const STREAM_RETRY_MAX_MS = 30_000;

/**
 * The live auction state for one vehicle detail page (design §13.3). Snapshots from every source
 * (the initial GET, the SSE stream, bid responses, and error responses) go through `apply()`,
 * which ignores anything older than the current version: a stream event and a POST response can
 * arrive in either order.
 */
@Injectable()
export class AuctionStateService {
  private readonly api = inject(VehiclesApi);
  private readonly clock = inject(ServerClock);
  private readonly stateSubject = new BehaviorSubject<AuctionState | null>(null);
  private readonly vehicleIdSubject = new BehaviorSubject<string | null>(null);

  readonly state$: Observable<AuctionState> = this.stateSubject.pipe(
    filter((state) => state !== null),
  );

  constructor() {
    const userId$ = inject(SessionService).user$.pipe(
      map((user) => user?.id ?? null),
      distinctUntilChanged(),
    );

    // Viewer-specific fields ("You're the high bidder") change when the buyer signs in or out.
    userId$.pipe(skip(1), takeUntilDestroyed()).subscribe(() => this.refresh());

    // Live updates (design §6.1). Each payload is built for the viewer, so the stream is reopened
    // when the buyer signs in or out. A refused stream is retried with backoff.
    combineLatest([this.vehicleIdSubject.pipe(distinctUntilChanged()), userId$])
      .pipe(
        switchMap(([vehicleId]) =>
          vehicleId === null
            ? EMPTY
            : this.api.auctionEvents(vehicleId).pipe(
                retry({
                  delay: (_error, attempt) =>
                    timer(Math.min(STREAM_RETRY_MAX_MS, 1_000 * 2 ** (attempt - 1))),
                  resetOnSuccess: true,
                }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.apply(state));

    // When the auction starts or ends, fetch the server's status and outcome rather than guessing.
    this.state$
      .pipe(
        map(nextBoundary),
        distinctUntilChanged(),
        switchMap((boundary) =>
          boundary === null
            ? EMPTY
            : timer(Math.max(0, boundary - this.clock.now()) + BOUNDARY_GRACE_MS),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.refresh());
  }

  get snapshot(): AuctionState | null {
    return this.stateSubject.value;
  }

  /** Starts tracking a vehicle, replacing any previous state. */
  load(vehicleId: string, state: AuctionState): void {
    this.stateSubject.next(state);
    this.vehicleIdSubject.next(vehicleId);
  }

  /** Applies a snapshot unless a newer one has already arrived. Equal versions may carry newer viewer or status data. */
  apply(state: AuctionState): void {
    const current = this.stateSubject.value;
    if (current === null || state.version >= current.version) this.stateSubject.next(state);
  }

  refresh(): void {
    this.reload().subscribe();
  }

  /** Fetches and applies the latest state; emits it, or null if it can't be loaded. */
  reload(): Observable<AuctionState | null> {
    const vehicleId = this.vehicleIdSubject.value;
    if (vehicleId === null) return of(null);
    return this.api.get(vehicleId).pipe(
      map((vehicle) => {
        if (vehicle.id === this.vehicleIdSubject.value) this.apply(vehicle.auction);
        return this.stateSubject.value;
      }),
      catchError(() => of(null)),
    );
  }
}

function nextBoundary(state: AuctionState): number | null {
  if (state.status === 'upcoming') return Date.parse(state.auctionStart);
  if (state.status === 'live') return Date.parse(state.auctionEnd);
  return null;
}
