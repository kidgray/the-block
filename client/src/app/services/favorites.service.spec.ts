import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { User } from '@the-block/shared';
import { BehaviorSubject, firstValueFrom, of, Subject, throwError } from 'rxjs';
import { FavoritesApi } from '../core/api/favorites-api';
import { SessionService } from '../core/session/session.service';
import { SignInService } from '../core/session/sign-in.service';
import { FavoritesService } from './favorites.service';

const BUYER: User = { id: 'demo-buyer', displayName: 'Demo Buyer' };

describe('FavoritesService', () => {
  let service: FavoritesService;
  let user$: BehaviorSubject<User | null>;
  let add: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  let ensureSignedIn: ReturnType<typeof vi.fn>;
  let openSnackBar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user$ = new BehaviorSubject<User | null>(BUYER);
    add = vi.fn(() => of(undefined));
    remove = vi.fn(() => of(undefined));
    ensureSignedIn = vi.fn(() => of(true));
    openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: FavoritesApi, useValue: { add, remove } },
        { provide: SessionService, useValue: { user$ } },
        { provide: SignInService, useValue: { ensureSignedIn } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    service = TestBed.inject(FavoritesService);
  });

  const isFavorite = (fromServer?: boolean) =>
    firstValueFrom(service.isFavorite$('v1', fromServer));

  it('starts from the flag the server sent', async () => {
    expect(await isFavorite(true)).toBe(true);
    expect(await isFavorite(false)).toBe(false);
    expect(await isFavorite(undefined)).toBe(false);
  });

  it('fills the heart at once, before the server answers', async () => {
    add.mockReturnValue(new Subject<void>());

    service.set('v1', true, '2018 Honda Pilot');

    expect(add).toHaveBeenCalledWith('v1');
    expect(await isFavorite(false)).toBe(true);
  });

  it('reverts the heart and says so when the request fails', async () => {
    remove.mockReturnValue(throwError(() => new Error('offline')));

    service.set('v1', false, '2018 Honda Pilot');

    expect(await isFavorite(true)).toBe(true);
    expect(openSnackBar).toHaveBeenCalledWith(
      "Couldn't remove the 2018 Honda Pilot from your favorites. Try again.",
      'Dismiss',
      expect.anything(),
    );
  });

  it('lets only the latest toggle revert the heart', async () => {
    const first = new Subject<void>();
    add.mockReturnValueOnce(first);

    service.set('v1', true, 'Pilot'); // still in flight
    service.set('v1', false, 'Pilot'); // succeeds
    first.error(new Error('offline')); // the older request fails late

    expect(await isFavorite(false)).toBe(false);
    expect(openSnackBar).not.toHaveBeenCalled();
  });

  it('asks a signed-out buyer to sign in first, and does nothing if they cancel', () => {
    user$.next(null);
    ensureSignedIn.mockReturnValue(of(false));

    service.set('v1', true, 'Pilot');

    expect(ensureSignedIn).toHaveBeenCalledTimes(1);
    expect(add).not.toHaveBeenCalled();
  });

  it('shows no favorites while signed out, and forgets changes when the buyer changes', async () => {
    service.set('v1', true, 'Pilot');
    user$.next(null);
    expect(await isFavorite(true)).toBe(false);

    user$.next(BUYER);
    expect(await isFavorite(false)).toBe(false); // the earlier change no longer applies
  });
});
