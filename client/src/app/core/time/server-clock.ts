import { Injectable } from '@angular/core';
import { map, share, timer } from 'rxjs';

/**
 * Corrects for the difference between the device clock and the server clock, so countdowns
 * follow the server (design §8.4, §13.3).
 */
@Injectable({ providedIn: 'root' })
export class ServerClock {
  private offsetMs = 0;

  /** One shared 1-second tick for every countdown on the page. */
  readonly tick$ = timer(0, 1000).pipe(
    map(() => this.now()),
    share(),
  );

  now(): number {
    return Date.now() + this.offsetMs;
  }

  sync(serverTime: string): void {
    const server = Date.parse(serverTime);
    if (!Number.isNaN(server)) this.offsetMs = server - Date.now();
  }
}
