import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { VehicleSummary } from '@the-block/shared';
import { Countdown } from '../countdown/countdown';
import { FavoriteToggle } from '../favorite-toggle/favorite-toggle';
import { StatusChip } from '../status-chip/status-chip';
import { CadPipe, KmPipe } from '../../shared/format/format';
import { VehicleImage } from '../vehicle-image/vehicle-image';

@Component({
  selector: 'app-vehicle-card',
  imports: [
    DecimalPipe,
    TitleCasePipe,
    RouterLink,
    CadPipe,
    KmPipe,
    Countdown,
    FavoriteToggle,
    StatusChip,
    VehicleImage,
  ],
  templateUrl: './vehicle-card.html',
  styleUrl: './vehicle-card.scss',
})
export class VehicleCard {
  @Input({ required: true }) vehicle!: VehicleSummary;
  /** Set for cards in the first visible row, which are likely the page's largest paint. */
  @Input() priority = false;
}
