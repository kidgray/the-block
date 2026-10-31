import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import type { VehicleSummary } from '@the-block/shared';
import { catchError, filter, map, type Observable, of, startWith, Subject, switchMap } from 'rxjs';
import { VehicleCard } from '../../components/vehicle-card/vehicle-card';
import { FavoritesApi } from '../../core/api/favorites-api';
import { SessionService } from '../../core/session/session.service';

type View =
  { state: 'loading' } | { state: 'error' } | { state: 'loaded'; vehicles: VehicleSummary[] };

/**
 * Design §7.6: the buyer's favorites as vehicle cards with their current auction status. A card
 * whose heart is cleared here stays until the page is reloaded, so the buyer can undo it.
 */
@Component({
  selector: 'app-favorites-page',
  imports: [AsyncPipe, RouterLink, MatButtonModule, MatIconModule, VehicleCard],
  templateUrl: './favorites-page.html',
  styleUrl: './favorites-page.scss',
})
export class FavoritesPage {
  private readonly api = inject(FavoritesApi);
  private readonly retry$ = new Subject<void>();

  protected readonly skeletons = Array.from({ length: 4 }, (_, index) => index);

  protected readonly view$: Observable<View> = this.retry$.pipe(
    startWith(undefined),
    switchMap(() =>
      this.api.list().pipe(
        map((vehicles): View => ({ state: 'loaded', vehicles })),
        startWith<View>({ state: 'loading' }),
        catchError(() => of<View>({ state: 'error' })),
      ),
    ),
  );

  constructor() {
    // Signing out on this page leaves nothing to show.
    const router = inject(Router);
    inject(SessionService)
      .user$.pipe(
        filter((user) => user === null),
        takeUntilDestroyed(),
      )
      .subscribe(() => void router.navigate(['/vehicles']));
  }

  protected retry(): void {
    this.retry$.next();
  }
}
