import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, of, switchMap, take } from 'rxjs';
import { SessionService } from './session.service';
import { SignInService } from './sign-in.service';

/**
 * Pages that need a buyer (design §7.4, §13.2): a signed-out visitor gets the sign-in dialog, and
 * navigation continues once they sign in. Dismissing the dialog returns them to the inventory.
 */
export const signInGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const signIn = inject(SignInService);
  const router = inject(Router);
  return session.user$.pipe(
    filter((user) => user !== undefined),
    take(1),
    switchMap((user) => (user ? of(true) : signIn.prompt())),
    map((signedIn) => signedIn || router.createUrlTree(['/vehicles'])),
  );
};
