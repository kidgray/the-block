import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { SessionState, User } from '@the-block/shared';
import { BehaviorSubject, catchError, map, type Observable, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  /** `undefined` until the startup check finishes, then the user or `null` (signed out). */
  private readonly userSubject = new BehaviorSubject<User | null | undefined>(undefined);

  readonly user$ = this.userSubject.asObservable();

  get currentUser(): User | null | undefined {
    return this.userSubject.value;
  }

  /**
   * Restores the signed-in state at startup (design §7.4). `GET /api/session` answers 200 either
   * way, so a signed-out visit logs no 401 errors; a network error is treated as signed out.
   */
  restore(): Observable<void> {
    return this.http.get<SessionState>('/api/session').pipe(
      map(({ user }) => user),
      catchError(() => of(null)),
      tap((user) => this.userSubject.next(user)),
      map(() => undefined),
    );
  }

  signIn(): Observable<User> {
    return this.http
      .post<User>('/api/session', {})
      .pipe(tap((user) => this.userSubject.next(user)));
  }

  signOut(): Observable<void> {
    return this.http.delete<void>('/api/session').pipe(tap(() => this.userSubject.next(null)));
  }

  markSignedOut(): void {
    this.userSubject.next(null);
  }
}
