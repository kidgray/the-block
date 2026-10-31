import { AsyncPipe } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { VehicleSummary } from '@the-block/shared';
import { ReplaySubject, switchMap } from 'rxjs';
import { FavoritesService } from '../../services/favorites.service';

/** The heart on vehicle cards and the detail page (design §7.6). Toggling requires sign-in. */
@Component({
  selector: 'app-favorite-toggle',
  imports: [AsyncPipe, MatButtonModule, MatIconModule],
  templateUrl: './favorite-toggle.html',
  styleUrl: './favorite-toggle.scss',
})
export class FavoriteToggle {
  private readonly favorites = inject(FavoritesService);
  private readonly vehicle$ = new ReplaySubject<Pick<VehicleSummary, 'id' | 'isFavorite'>>(1);
  private vehicleId = '';

  @Input({ required: true }) set vehicle(vehicle: Pick<VehicleSummary, 'id' | 'isFavorite'>) {
    this.vehicleId = vehicle.id;
    this.vehicle$.next(vehicle);
  }
  @Input({ required: true }) vehicleTitle!: string;

  protected readonly favorite$ = this.vehicle$.pipe(
    switchMap((vehicle) => this.favorites.isFavorite$(vehicle.id, vehicle.isFavorite)),
  );

  protected toggle(favorite: boolean): void {
    this.favorites.set(this.vehicleId, favorite, this.vehicleTitle);
  }
}
