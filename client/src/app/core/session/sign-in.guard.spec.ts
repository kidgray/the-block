import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import type { User } from '@the-block/shared';
import { BehaviorSubject, firstValueFrom, type Observable, of } from 'rxjs';
import { SessionService } from './session.service';
import { signInGuard } from './sign-in.guard';
import { SignInService } from './sign-in.service';

describe('signInGuard', () => {
  let prompt: ReturnType<typeof vi.fn>;

  function run(user: User | null, promptResult = false): Promise<boolean | UrlTree> {
    prompt = vi.fn(() => of(promptResult));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { user$: new BehaviorSubject(user) } },
        { provide: SignInService, useValue: { prompt } },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      signInGuard({} as never, {} as never),
    ) as Observable<boolean | UrlTree>;
    return firstValueFrom(result);
  }

  it('lets a signed-in buyer through without a prompt', async () => {
    expect(await run({ id: 'demo-buyer', displayName: 'Demo Buyer' })).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('continues once a signed-out visitor signs in', async () => {
    expect(await run(null, true)).toBe(true);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('returns to the inventory when the visitor dismisses sign-in', async () => {
    const result = await run(null, false);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/vehicles');
  });
});
