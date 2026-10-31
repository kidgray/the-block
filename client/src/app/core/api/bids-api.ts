import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { AuctionState, MyBidsResponse, PlaceBidRequest } from '@the-block/shared';
import { type Observable, tap } from 'rxjs';
import { IDEMPOTENCY_KEY } from '../http/context';
import { ServerClock } from '../time/server-clock';

@Injectable({ providedIn: 'root' })
export class BidsApi {
  private readonly http = inject(HttpClient);
  private readonly clock = inject(ServerClock);

  /** The key identifies one confirmed bid; retries of that bid reuse it (design §12.5). */
  placeBid(
    vehicleId: string,
    request: PlaceBidRequest,
    idempotencyKey: string,
  ): Observable<AuctionState> {
    return this.http
      .post<AuctionState>(`/api/vehicles/${encodeURIComponent(vehicleId)}/bids`, request, {
        context: new HttpContext().set(IDEMPOTENCY_KEY, idempotencyKey),
      })
      .pipe(tap((state) => this.clock.sync(state.serverTime)));
  }

  /** Buys the vehicle at its Buy Now price, ending the auction (design §8.5). */
  buyNow(vehicleId: string, idempotencyKey: string): Observable<AuctionState> {
    return this.http
      .post<AuctionState>(
        `/api/vehicles/${encodeURIComponent(vehicleId)}/buy-now`,
        {},
        { context: new HttpContext().set(IDEMPOTENCY_KEY, idempotencyKey) },
      )
      .pipe(tap((state) => this.clock.sync(state.serverTime)));
  }

  /** Every auction the buyer bid on or bought, split into Active and Ended (design §7.5). */
  myBids(): Observable<MyBidsResponse> {
    return this.http.get<MyBidsResponse>('/api/me/bids').pipe(
      tap(({ active, ended }) => {
        const first = active[0] ?? ended[0];
        if (first) this.clock.sync(first.vehicle.auction.serverTime);
      }),
    );
  }
}

/** `crypto.randomUUID` needs a secure context; fall back to random bytes (e.g., over plain HTTP on a LAN). */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
