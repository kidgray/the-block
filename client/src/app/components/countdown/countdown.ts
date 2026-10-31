import { AsyncPipe } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import type { AuctionState } from '@the-block/shared';
import { BehaviorSubject, combineLatest, filter, map } from 'rxjs';
import { ServerClock } from '../../core/time/server-clock';

const MINUTE_MS = 60_000;
const SECONDS_THRESHOLD_MS = 10 * MINUTE_MS;

type CountdownAuction = Pick<AuctionState, 'status' | 'auctionStart' | 'auctionEnd'>;

/** Hours and minutes; seconds appear only in the final 10 minutes (design §9). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (ms >= SECONDS_THRESHOLD_MS) return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

export function countdownLabel(auction: CountdownAuction, now: number): string {
  if (auction.status === 'ended') return 'Ended';
  const upcoming = auction.status === 'upcoming';
  const remaining = Date.parse(upcoming ? auction.auctionStart : auction.auctionEnd) - now;
  if (remaining <= 0) return upcoming ? 'Starting…' : 'Ending…';
  return `${upcoming ? 'Starts in' : 'Ends in'} ${formatDuration(remaining)}`;
}

export function isEndingSoon(auction: CountdownAuction, now: number): boolean {
  return auction.status === 'live' && Date.parse(auction.auctionEnd) - now < SECONDS_THRESHOLD_MS;
}

@Component({
  selector: 'app-countdown',
  imports: [AsyncPipe],
  templateUrl: './countdown.html',
  styleUrl: './countdown.scss',
})
export class Countdown {
  private readonly auction$ = new BehaviorSubject<CountdownAuction | null>(null);

  @Input({ required: true }) set auction(auction: CountdownAuction) {
    this.auction$.next(auction);
  }

  protected readonly view$ = combineLatest([
    this.auction$.pipe(filter((auction) => auction !== null)),
    inject(ServerClock).tick$,
  ]).pipe(
    map(([auction, now]) => ({
      label: countdownLabel(auction, now),
      urgent: isEndingSoon(auction, now),
    })),
  );
}
