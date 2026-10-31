import { Component, Input } from '@angular/core';
import type { AuctionState } from '@the-block/shared';

type Tone = 'live' | 'upcoming' | 'sold' | 'closed';

export function statusChip(auction: Pick<AuctionState, 'status' | 'outcome'>): {
  label: string;
  tone: Tone;
} {
  if (auction.status === 'live') return { label: 'Live', tone: 'live' };
  if (auction.status === 'upcoming') return { label: 'Upcoming', tone: 'upcoming' };
  switch (auction.outcome) {
    case 'sold':
    case 'sold_buy_now':
      return { label: 'Sold', tone: 'sold' };
    case 'reserve_not_met':
      return { label: 'Reserve not met', tone: 'closed' };
    case 'no_sale':
      return { label: 'No sale', tone: 'closed' };
    default:
      return { label: 'Ended', tone: 'closed' };
  }
}

@Component({
  selector: 'app-status-chip',
  templateUrl: './status-chip.html',
  styleUrl: './status-chip.scss',
})
export class StatusChip {
  @Input({ required: true }) auction!: Pick<AuctionState, 'status' | 'outcome'>;

  protected get view() {
    return statusChip(this.auction);
  }
}
