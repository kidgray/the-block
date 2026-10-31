import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { FavoritesService } from '../../services/favorites.service';
import { FavoriteToggle } from './favorite-toggle';

describe('FavoriteToggle', () => {
  let fixture: ComponentFixture<FavoriteToggle>;
  let favorite$: BehaviorSubject<boolean>;
  let set: ReturnType<typeof vi.fn>;
  let isFavorite$: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    favorite$ = new BehaviorSubject(false);
    set = vi.fn();
    isFavorite$ = vi.fn(() => favorite$);
    TestBed.configureTestingModule({
      providers: [{ provide: FavoritesService, useValue: { isFavorite$, set } }],
    });
    fixture = TestBed.createComponent(FavoriteToggle);
    fixture.componentRef.setInput('vehicle', { id: 'v1', isFavorite: false });
    fixture.componentRef.setInput('vehicleTitle', '2018 Honda Pilot Touring');
    await fixture.whenStable();
  });

  const button = () => (fixture.nativeElement as HTMLElement).querySelector('button')!;

  it('is a toggle button named after the vehicle', () => {
    expect(isFavorite$).toHaveBeenCalledWith('v1', false);
    expect(button().getAttribute('aria-label')).toBe('Favorite: 2018 Honda Pilot Touring');
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().textContent?.trim()).toBe('favorite_border');
  });

  it('shows a filled heart once favorited', async () => {
    favorite$.next(true);
    await fixture.whenStable();
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().textContent?.trim()).toBe('favorite');
  });

  it('asks for the opposite of what it shows', async () => {
    button().click();
    expect(set).toHaveBeenCalledWith('v1', true, '2018 Honda Pilot Touring');

    favorite$.next(true);
    await fixture.whenStable();
    button().click();
    expect(set).toHaveBeenLastCalledWith('v1', false, '2018 Honda Pilot Touring');
  });
});
