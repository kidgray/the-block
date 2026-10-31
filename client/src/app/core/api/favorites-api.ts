import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { VehicleSummary } from '@the-block/shared';
import { type Observable, tap } from 'rxjs';
import { ServerClock } from '../time/server-clock';

/** The buyer's favorites (design §7.6, §12.2). Adding and removing are idempotent on the server. */
@Injectable({ providedIn: 'root' })
export class FavoritesApi {
  private readonly http = inject(HttpClient);
  private readonly clock = inject(ServerClock);

  list(): Observable<VehicleSummary[]> {
    return this.http.get<VehicleSummary[]>('/api/me/favorites').pipe(
      tap((vehicles) => {
        if (vehicles[0]) this.clock.sync(vehicles[0].auction.serverTime);
      }),
    );
  }

  add(vehicleId: string): Observable<void> {
    return this.http.put<void>(`/api/me/favorites/${encodeURIComponent(vehicleId)}`, {});
  }

  remove(vehicleId: string): Observable<void> {
    return this.http.delete<void>(`/api/me/favorites/${encodeURIComponent(vehicleId)}`);
  }
}
