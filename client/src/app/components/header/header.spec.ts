import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { User } from '@the-block/shared';
import { BehaviorSubject, of } from 'rxjs';
import { SessionService } from '../../core/session/session.service';
import { SignInService } from '../../core/session/sign-in.service';
import { Header } from './header';

describe('Header', () => {
  let element: HTMLElement;
  let ensureSignedIn: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;

  /** `undefined` means the startup session check hasn't finished. */
  async function render(user: User | null | undefined): Promise<void> {
    ensureSignedIn = vi.fn(() => of(true));
    signOut = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { user$: new BehaviorSubject(user), signOut } },
        { provide: SignInService, useValue: { ensureSignedIn } },
      ],
    });
    const fixture = TestBed.createComponent(Header);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
  }

  it('links to the inventory, My Bids, and Favorites', async () => {
    await render(null);
    expect(element.querySelector('a.brand')?.getAttribute('href')).toBe('/vehicles');
    expect(element.querySelector('a.brand')?.getAttribute('aria-label')).toBe(
      'The Block, inventory',
    );
    // The accessible name: icon links carry an aria-label, so phones can show the icon alone.
    const links = [...element.querySelectorAll('nav a')].map((link) => [
      link.getAttribute('aria-label') ?? link.textContent?.trim(),
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Inventory', '/vehicles'],
      ['My Bids', '/my-bids'],
      ['Favorites', '/favorites'],
    ]);
  });

  it('offers "Sign in" to a signed-out visitor', async () => {
    await render(null);
    button('Sign in')!.click();
    expect(ensureSignedIn).toHaveBeenCalledTimes(1);
  });

  it('shows the buyer and "Sign out" once signed in', async () => {
    await render({ id: 'demo-buyer', displayName: 'Demo Buyer' });
    expect(element.querySelector('.name')?.textContent).toBe('Demo Buyer');
    expect(button('Sign in')).toBeUndefined();

    button('Sign out')!.click();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('shows neither button until the session check finishes', async () => {
    await render(undefined);
    expect(button('Sign in')).toBeUndefined();
    expect(button('Sign out')).toBeUndefined();
  });
});
