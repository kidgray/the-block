import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MyBidRow as MyBidRowData, MyBidStatus } from '@the-block/shared';
import { CadPipe } from '../../shared/format/format';
import { Countdown } from '../countdown/countdown';
import { VehicleImage } from '../vehicle-image/vehicle-image';

type Tone = 'success' | 'error' | 'primary' | 'neutral';

/** Design §7.5: what each status is called, and how it is coloured. */
export const MY_BID_STATUS_VIEW: Record<MyBidStatus, { label: string; tone: Tone }> = {
  winning: { label: 'Winning', tone: 'success' },
  outbid: { label: 'Outbid', tone: 'error' },
  won: { label: 'Won', tone: 'success' },
  lost: { label: 'Lost', tone: 'neutral' },
  reserve_not_met: { label: 'Reserve not met', tone: 'neutral' },
  purchased: { label: 'Purchased', tone: 'primary' },
};

/** One auction on the My Bids page, linking to its vehicle. */
@Component({
  selector: 'app-my-bid-row',
  imports: [DatePipe, RouterLink, CadPipe, Countdown, VehicleImage],
  templateUrl: './my-bid-row.html',
  styleUrl: './my-bid-row.scss',
})
export class MyBidRow {
  @Input({ required: true }) row!: MyBidRowData;

  protected get status() {
    return MY_BID_STATUS_VIEW[this.row.status];
  }

  protected get isActive(): boolean {
    return this.row.status === 'winning' || this.row.status === 'outbid';
  }
}
