import { AsyncPipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { TitleStatus, VehicleDetail } from '@the-block/shared';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  type Observable,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { VehiclesApi } from '../../core/api/vehicles-api';
import { ApiProblem } from '../../core/http/api-problem';
import { InventoryHistory } from '../../core/navigation/inventory-history';
import { KmPipe } from '../../shared/format/format';
import { AuctionStateService } from '../../services/auction-state.service';
import { BidPanel } from '../../components/bid-panel/bid-panel';
import { FavoriteToggle } from '../../components/favorite-toggle/favorite-toggle';
import { Gallery } from '../../components/gallery/gallery';

type PageState =
  | { state: 'loading' }
  | { state: 'not-found' }
  | { state: 'error' }
  | { state: 'loaded'; vehicle: VehicleDetail; title: string };

/** Rebuilt and salvage titles are prominently flagged: a key trust signal for buyers (design §7.2). */
const TITLE_WARNINGS: Partial<Record<TitleStatus, { heading: string; text: string }>> = {
  rebuilt: {
    heading: 'Rebuilt title',
    text: 'This vehicle was previously declared a total loss, then repaired and re-inspected. A rebuilt title can affect insurance and resale value.',
  },
  salvage: {
    heading: 'Salvage title',
    text: 'An insurer declared this vehicle a total loss. It may not be road-legal until it is repaired and passes inspection.',
  },
};

@Component({
  selector: 'app-vehicle-page',
  imports: [
    AsyncPipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    KmPipe,
    BidPanel,
    FavoriteToggle,
    Gallery,
  ],
  providers: [AuctionStateService],
  templateUrl: './vehicle-page.html',
  styleUrl: './vehicle-page.scss',
})
export class VehiclePage {
  private readonly api = inject(VehiclesApi);
  private readonly auction = inject(AuctionStateService);
  private readonly pageTitle = inject(Title);
  private readonly reload$ = new Subject<void>();

  protected readonly history = inject(InventoryHistory);
  protected readonly titleWarnings = TITLE_WARNINGS;

  protected readonly page$: Observable<PageState> = combineLatest([
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => params.get('id') ?? ''),
      distinctUntilChanged(),
    ),
    this.reload$.pipe(startWith(undefined)),
  ]).pipe(
    switchMap(([id]) =>
      this.api.get(id).pipe(
        tap((vehicle) => this.auction.load(vehicle.id, vehicle.auction)),
        map((vehicle): PageState => {
          const title = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
          this.pageTitle.setTitle(`${title} · The Block`);
          return { state: 'loaded', vehicle, title };
        }),
        startWith<PageState>({ state: 'loading' }),
        catchError((error: unknown) =>
          of<PageState>({
            state: error instanceof ApiProblem && error.status === 404 ? 'not-found' : 'error',
          }),
        ),
      ),
    ),
  );

  protected retry(): void {
    this.reload$.next();
  }
}
