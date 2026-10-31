import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  AuctionState,
  ListVehiclesQuery,
  VehicleDetail,
  VehicleFacets,
  VehicleListResponse,
} from '@the-block/shared';
import { Observable, shareReplay, tap } from 'rxjs';
import { EVENT_SOURCE, EVENT_SOURCE_CLOSED } from '../http/event-source';
import { ServerClock } from '../time/server-clock';

@Injectable({ providedIn: 'root' })
export class VehiclesApi {
  private readonly http = inject(HttpClient);
  private readonly clock = inject(ServerClock);
  private readonly openEventSource = inject(EVENT_SOURCE);

  /** The filter values only change on a re-seed, so one request serves the whole session. */
  private readonly facets$ = this.http
    .get<VehicleFacets>('/api/vehicles/facets')
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  list(query: ListVehiclesQuery): Observable<VehicleListResponse> {
    return this.http.get<VehicleListResponse>('/api/vehicles', { params: toParams(query) }).pipe(
      tap(({ items }) => {
        if (items[0]) this.clock.sync(items[0].auction.serverTime);
      }),
    );
  }

  facets(): Observable<VehicleFacets> {
    return this.facets$;
  }

  get(vehicleId: string): Observable<VehicleDetail> {
    return this.http
      .get<VehicleDetail>(`/api/vehicles/${encodeURIComponent(vehicleId)}`)
      .pipe(tap((vehicle) => this.clock.sync(vehicle.auction.serverTime)));
  }

  /**
   * Live auction snapshots over Server-Sent Events (design §6.1). The first one is the current
   * state. The browser reconnects a dropped stream by itself; the Observable errors only when the
   * stream is refused, and unsubscribing closes the connection.
   */
  auctionEvents(vehicleId: string): Observable<AuctionState> {
    return new Observable<AuctionState>((subscriber) => {
      const source = this.openEventSource(`/api/vehicles/${encodeURIComponent(vehicleId)}/events`);
      source.addEventListener('auction', (event) => {
        const state = JSON.parse((event as MessageEvent<string>).data) as AuctionState;
        this.clock.sync(state.serverTime);
        subscriber.next(state);
      });
      source.addEventListener('error', () => {
        if (source.readyState === EVENT_SOURCE_CLOSED) {
          subscriber.error(new Error('The live updates stream was closed.'));
        }
      });
      return () => source.close();
    });
  }
}

/** Design §12.3: repeatable filters repeat their key; unset filters are left out. */
export function toParams(query: ListVehiclesQuery): HttpParams {
  let params = new HttpParams().set('sort', query.sort).set('page', query.page);
  if (query.q) params = params.set('q', query.q);
  const repeated: [string, readonly string[] | undefined][] = [
    ['status', query.status],
    ['make', query.make],
    ['bodyStyle', query.bodyStyle],
    ['province', query.province],
    ['titleStatus', query.titleStatus],
  ];
  for (const [key, values] of repeated) {
    for (const value of values ?? []) params = params.append(key, value);
  }
  const single: [string, number | undefined][] = [
    ['yearMin', query.yearMin],
    ['yearMax', query.yearMax],
    ['priceMin', query.priceMin],
    ['priceMax', query.priceMax],
    ['gradeMin', query.gradeMin],
  ];
  for (const [key, value] of single) {
    if (value !== undefined) params = params.set(key, value);
  }
  if (query.buyNow) params = params.set('buyNow', 'true');
  return params;
}
