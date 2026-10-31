import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { User } from '@the-block/shared';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { auctionState, vehicleSummary } from '../../../testing/fixtures';
import { FavoritesApi } from '../../core/api/favorites-api';
import { SessionService } from '../../core/session/session.service';
import { FavoritesPage } from './favorites-page';

describe('FavoritesPage', () => {
  let harness: RouterTestingHarness;
  let list: ReturnType<typeof vi.fn>;
  let user$: BehaviorSubject<User | null>;

  async function render(listFavorites: ReturnType<typeof vi.fn>): Promise<void> {
    list = listFavorites;
    user$ = new BehaviorSubject<User | null>({ id: 'demo-buyer', displayName: 'Demo Buyer' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'favorites', component: FavoritesPage },
          { path: 'vehicles', children: [] },
        ]),
        { provide: FavoritesApi, useValue: { list } },
        { provide: SessionService, useValue: { user$ } },
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/favorites', FavoritesPage);
    await harness.fixture.whenStable();
  }

  const element = () => harness.routeNativeElement!;

  it('lists favorites as vehicle cards with their auction status', async () => {
    await render(
      vi.fn(() =>
        of([
          vehicleSummary({ isFavorite: true }),
          vehicleSummary({
            id: 'v2',
            isFavorite: true,
            auction: auctionState({ status: 'ended', outcome: 'sold' }),
          }),
        ]),
      ),
    );
    expect(element().querySelector('.count')?.textContent?.trim()).toBe('2 vehicles');
    expect(element().querySelectorAll('app-vehicle-card')).toHaveLength(2);
    const secondCard = element().querySelectorAll('app-vehicle-card')[1];
    expect(secondCard?.querySelector('span.chip')?.textContent?.trim()).toBe('Sold');
  });

  it('explains how to add favorites when there are none', async () => {
    await render(vi.fn(() => of([])));
    expect(element().querySelector('.empty p')?.textContent).toContain('Tap the heart');
    expect(element().querySelector('.empty a')?.getAttribute('href')).toBe('/vehicles');
  });

  it('offers a retry when loading fails', async () => {
    await render(vi.fn(() => throwError(() => new Error('offline'))));
    expect(element().querySelector('[role=alert]')?.textContent).toContain(
      "Couldn't load your favorites.",
    );

    list.mockReturnValue(of([vehicleSummary({ isFavorite: true })]));
    element().querySelector<HTMLButtonElement>('[role=alert] button')!.click();
    await harness.fixture.whenStable();
    expect(element().querySelectorAll('app-vehicle-card')).toHaveLength(1);
  });

  it('returns to the inventory when the buyer signs out', async () => {
    await render(vi.fn(() => of([])));
    user$.next(null);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/vehicles');
  });
});
