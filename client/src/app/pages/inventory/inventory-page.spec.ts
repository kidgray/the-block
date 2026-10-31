import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { User, VehicleFacets, VehicleListResponse } from '@the-block/shared';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vehicleSummary } from '../../../testing/fixtures';
import { VehiclesApi } from '../../core/api/vehicles-api';
import { SessionService } from '../../core/session/session.service';
import { InventoryPage } from './inventory-page';

const FACETS: VehicleFacets = {
  makes: ['Ford', 'Honda'],
  bodyStyles: ['sedan', 'truck'],
  provinces: ['Alberta', 'Ontario'],
};

const ONE_RESULT: VehicleListResponse = {
  items: [vehicleSummary()],
  total: 25,
  page: 2,
  pageSize: 24,
};

describe('InventoryPage', () => {
  let harness: RouterTestingHarness;
  let list: ReturnType<typeof vi.fn>;
  let user$: BehaviorSubject<User | null>;

  async function render(url: string, listVehicles: ReturnType<typeof vi.fn>): Promise<void> {
    list = listVehicles;
    user$ = new BehaviorSubject<User | null>(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: { user$ } },
        provideRouter([{ path: 'vehicles', component: InventoryPage }]),
        { provide: VehiclesApi, useValue: { list, facets: () => of(FACETS) } },
        // Desktop layout: filters in the sidebar.
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: true }) } },
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, InventoryPage);
    await harness.fixture.whenStable();
  }

  const element = () => harness.routeNativeElement!;
  const text = (selector: string) => element().querySelector(selector)?.textContent?.trim();

  it('searches with the state in the URL and lists the results', async () => {
    await render(
      '/vehicles?q=civic&status=ended&sort=priceAsc&page=2',
      vi.fn(() => of(ONE_RESULT)),
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'civic', status: ['ended'], sort: 'priceAsc', page: 2 }),
    );
    expect(element().querySelector<HTMLInputElement>('input[type=search]')?.value).toBe('civic');
    expect(text('.count')).toBe('25 vehicles');
    expect(element().querySelectorAll('app-vehicle-card')).toHaveLength(1);
    expect(element().querySelector('aside.sidebar app-filters-panel')).toBeTruthy();
    expect(element().querySelector('[aria-current=page]')?.textContent?.trim()).toBe('2');
  });

  it('sends the filters in the URL to the API, and offers the filter values', async () => {
    await render(
      '/vehicles?make=Ford&titleStatus=salvage&yearMin=2018&priceMax=30000&gradeMin=3&buyNow=true',
      vi.fn(() => of(ONE_RESULT)),
    );
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        make: ['Ford'],
        titleStatus: ['salvage'],
        yearMin: 2018,
        priceMax: 30_000,
        gradeMin: 3,
        buyNow: true,
      }),
    );
    expect(element().querySelector('aside.sidebar')?.textContent).toContain('Make');
  });

  it('offers "Clear filters" when nothing matches', async () => {
    await render(
      '/vehicles?q=zzz',
      vi.fn(() => of({ ...ONE_RESULT, items: [], total: 0 })),
    );
    expect(text('.empty h2')).toBe('No vehicles match');
    expect(text('.empty button')).toBe('Clear filters');
  });

  it('shows an error with Retry, and Retry asks again', async () => {
    await render(
      '/vehicles',
      vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('API down')))
        .mockReturnValue(of(ONE_RESULT)),
    );
    expect(text('.empty h2')).toBe("Couldn't load vehicles");

    element().querySelector<HTMLButtonElement>('.empty button')!.click();
    await harness.fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(2);
    expect(text('.count')).toBe('25 vehicles');
  });

  it('reloads the same results quietly when the buyer signs in, for their favorites', async () => {
    await render(
      '/vehicles?q=civic',
      vi.fn(() => of(ONE_RESULT)),
    );
    expect(list).toHaveBeenCalledTimes(1);

    const favorited = { ...ONE_RESULT, items: [vehicleSummary({ isFavorite: true })] };
    list.mockReturnValue(of(favorited));
    user$.next({ id: 'demo-buyer', displayName: 'Demo Buyer' });
    await harness.fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'civic' }));
    expect(element().querySelectorAll('app-vehicle-card')).toHaveLength(1);
  });
});
