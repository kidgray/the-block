import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import type { MyBidsResponse } from '@the-block/shared';
import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  interval,
  map,
  merge,
  type Observable,
  of,
  scan,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';
import { MyBidRow } from '../../components/my-bid-row/my-bid-row';
import { BidsApi } from '../../core/api/bids-api';
import { SessionService } from '../../core/session/session.service';

export const ACTIVE_REFRESH_MS = 30_000;

type View = { state: 'loading' } | { state: 'error' } | { state: 'loaded'; data: MyBidsResponse };

/** Tab indexes in the template. */
const ACTIVE_TAB = 0;
const ENDED_TAB = 1;

/** Design §7.5: the buyer's auctions, refreshed every 30 seconds while the Active tab is open. */
@Component({
  selector: 'app-my-bids-page',
  imports: [
    AsyncPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MyBidRow,
  ],
  templateUrl: './my-bids-page.html',
  styleUrl: './my-bids-page.scss',
})
export class MyBidsPage {
  private readonly api = inject(BidsApi);
  private readonly selectedTab$ = new BehaviorSubject(ACTIVE_TAB);
  private readonly retry$ = new Subject<void>();

  protected readonly view$: Observable<View> = merge(
    this.retry$.pipe(startWith(undefined)),
    this.selectedTab$.pipe(
      distinctUntilChanged(),
      switchMap((tab) => (tab === ACTIVE_TAB ? interval(ACTIVE_REFRESH_MS) : EMPTY)),
    ),
  ).pipe(
    switchMap(() =>
      this.api.myBids().pipe(
        map((data): View => ({ state: 'loaded', data })),
        catchError(() => of<View>({ state: 'error' })),
      ),
    ),
    // A failed background refresh keeps the rows already on screen.
    scan((previous: View, next: View) =>
      next.state === 'error' && previous.state === 'loaded' ? previous : next,
    ),
    startWith<View>({ state: 'loading' }),
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

  protected selectTab(index: number): void {
    this.selectedTab$.next(index === ENDED_TAB ? ENDED_TAB : ACTIVE_TAB);
  }

  protected retry(): void {
    this.retry$.next();
  }
}
