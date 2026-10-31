import { BreakpointObserver } from '@angular/cdk/layout';
import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, type Params, Router } from '@angular/router';
import type { VehicleFacets, VehicleListResponse } from '@the-block/shared';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  merge,
  type Observable,
  of,
  shareReplay,
  skip,
  startWith,
  Subject,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import { VehiclesApi } from '../../core/api/vehicles-api';
import { InventoryHistory } from '../../core/navigation/inventory-history';
import { SessionService } from '../../core/session/session.service';
import { NumberedPaginator } from '../../components/numbered-paginator/numbered-paginator';
import { VehicleCard } from '../../components/vehicle-card/vehicle-card';
import {
  FiltersDrawer,
  type FiltersDrawerData,
} from '../../components/filters-drawer/filters-drawer';
import { FiltersPanel } from '../../components/filters-panel/filters-panel';
import {
  activeFilterCount,
  filterParams,
  filtersOf,
  type InventoryFilters,
  type InventoryQuery,
  parseInventoryQuery,
  toListQuery,
} from '../../shared/inventory-query/inventory-query';

type Results =
  { state: 'loading' } | { state: 'error' } | { state: 'loaded'; data: VehicleListResponse };

const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-inventory-page',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    FiltersPanel,
    NumberedPaginator,
    VehicleCard,
  ],
  templateUrl: './inventory-page.html',
  styleUrl: './inventory-page.scss',
})
export class InventoryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(VehiclesApi);
  private readonly dialog = inject(MatDialog);
  private readonly history = inject(InventoryHistory);
  private readonly reload$ = new Subject<void>();

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly skeletons = Array.from({ length: 8 }, (_, index) => index);
  protected readonly filtersOf = filtersOf;
  protected readonly activeFilterCount = activeFilterCount;

  protected readonly query$: Observable<InventoryQuery> = this.route.queryParamMap.pipe(
    map(parseInventoryQuery),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Each new query cancels the request still in flight, so results never arrive out of order.
   * Signing in or out reloads the same page quietly (no skeletons), because cards show the buyer's
   * favorites.
   */
  protected readonly results$: Observable<Results> = merge(
    combineLatest([this.query$, this.reload$.pipe(startWith(undefined))]).pipe(
      map(([query]) => ({ query, quiet: false })),
    ),
    inject(SessionService).user$.pipe(
      map((user) => user?.id ?? null),
      distinctUntilChanged(),
      skip(1),
      withLatestFrom(this.query$),
      map(([, query]) => ({ query, quiet: true })),
    ),
  ).pipe(
    switchMap(({ query, quiet }) => {
      const load$ = this.api.list(toListQuery(query)).pipe(
        map((data): Results => ({ state: 'loaded', data })),
        catchError(() => of<Results>({ state: 'error' })),
      );
      return quiet ? load$ : load$.pipe(startWith<Results>({ state: 'loading' }));
    }),
  );

  /** Options for the make, body style, and province filters; null until loaded (or if they fail). */
  protected readonly facets$: Observable<VehicleFacets | null> = this.api.facets().pipe(
    catchError(() => of<VehicleFacets | null>(null)),
    startWith<VehicleFacets | null>(null),
  );

  protected readonly isDesktop$ = inject(BreakpointObserver)
    .observe('(min-width: 1024px)')
    .pipe(map((state) => state.matches));

  constructor() {
    // URL → search box (back/forward and shared links), and remember the view for "Back to results".
    this.query$.pipe(takeUntilDestroyed()).subscribe((query) => {
      this.history.lastQueryParams = this.route.snapshot.queryParams;
      if (this.search.value.trim() !== query.q) this.search.setValue(query.q, { emitEvent: false });
    });

    // Search box → URL, 300 ms after typing stops (design §7.1). Typing replaces the history entry.
    this.search.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((value) => value.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((q) => this.navigate({ q: q || null, page: null }, true));
  }

  protected applyFilters(filters: InventoryFilters): void {
    this.navigate(filterParams(filters));
  }

  protected openFilters(query: InventoryQuery, facets: VehicleFacets | null): void {
    this.dialog
      .open<FiltersDrawer, FiltersDrawerData, InventoryFilters>(FiltersDrawer, {
        data: { filters: filtersOf(query), facets },
        position: { top: '0', right: '0' },
        width: 'min(360px, 100vw)',
        maxWidth: '100vw',
        height: '100%',
        maxHeight: '100vh',
        panelClass: 'filters-drawer',
      })
      .afterClosed()
      .pipe(filter((filters) => filters !== undefined))
      .subscribe((filters) => this.applyFilters(filters));
  }

  protected clearAll(): void {
    this.search.setValue('', { emitEvent: false });
    void this.router.navigate([], { relativeTo: this.route });
  }

  protected retry(): void {
    this.reload$.next();
  }

  private navigate(params: Params, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
