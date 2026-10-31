import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  type Observable,
} from 'rxjs';
import { FavoritesApi } from '../core/api/favorites-api';
import { SessionService } from '../core/session/session.service';
import { SignInService } from '../core/session/sign-in.service';

/**
 * Favorites (design §7.6). A toggle changes the heart at once and reverts it if the request fails:
 * acceptable for favorites, which are low-stakes and easily undone, unlike bids. Changes made in
 * this session take precedence over the flag in responses loaded before them.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly api = inject(FavoritesApi);
  private readonly session = inject(SessionService);
  private readonly signIn = inject(SignInService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly changes = new BehaviorSubject<ReadonlyMap<string, boolean>>(new Map());
  /** The latest toggle per vehicle: only its failure may revert the heart. */
  private readonly latestRequest = new Map<string, number>();
  private requestCount = 0;

  private readonly userId$ = this.session.user$.pipe(
    map((user) => user?.id ?? null),
    distinctUntilChanged(),
  );

  constructor() {
    // Another buyer (or nobody) is looking now, so earlier changes no longer apply.
    this.userId$.subscribe(() => this.changes.next(new Map()));
  }

  /** Whether the heart is filled. Signed-out buyers have no favorites. */
  isFavorite$(vehicleId: string, fromServer: boolean | undefined): Observable<boolean> {
    return combineLatest([this.userId$, this.changes]).pipe(
      map(
        ([userId, changes]) => userId !== null && (changes.get(vehicleId) ?? fromServer ?? false),
      ),
      distinctUntilChanged(),
    );
  }

  /** Signs in first if needed, then adds or removes the favorite optimistically. */
  set(vehicleId: string, favorite: boolean, vehicleTitle: string): void {
    this.signIn
      .ensureSignedIn()
      .pipe(filter(Boolean))
      .subscribe(() => this.write(vehicleId, favorite, vehicleTitle));
  }

  private write(vehicleId: string, favorite: boolean, vehicleTitle: string): void {
    const request = ++this.requestCount;
    this.latestRequest.set(vehicleId, request);
    this.record(vehicleId, favorite);

    (favorite ? this.api.add(vehicleId) : this.api.remove(vehicleId)).subscribe({
      error: () => {
        if (this.latestRequest.get(vehicleId) !== request) return;
        this.record(vehicleId, !favorite);
        this.snackBar.open(
          favorite
            ? `Couldn't save the ${vehicleTitle} to your favorites. Try again.`
            : `Couldn't remove the ${vehicleTitle} from your favorites. Try again.`,
          'Dismiss',
          { duration: 6_000 },
        );
      },
    });
  }

  private record(vehicleId: string, favorite: boolean): void {
    const changes = new Map(this.changes.value);
    changes.set(vehicleId, favorite);
    this.changes.next(changes);
  }
}
