import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { VehicleFacets } from '@the-block/shared';
import { BehaviorSubject } from 'rxjs';
import { FiltersPanel } from '../filters-panel/filters-panel';
import {
  defaultFilters,
  type InventoryFilters,
} from '../../shared/inventory-query/inventory-query';

export interface FiltersDrawerData {
  filters: InventoryFilters;
  facets: VehicleFacets | null;
}

/**
 * Mobile filter drawer (design §9). A dialog provides focus trapping, Escape to close, and focus
 * return; changes apply only on "Apply".
 */
@Component({
  selector: 'app-filters-drawer',
  imports: [AsyncPipe, FiltersPanel, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './filters-drawer.html',
  styleUrl: './filters-drawer.scss',
})
export class FiltersDrawer {
  private readonly dialogRef = inject<MatDialogRef<FiltersDrawer, InventoryFilters>>(MatDialogRef);

  private readonly data = inject<FiltersDrawerData>(MAT_DIALOG_DATA);

  protected readonly facets = this.data.facets;
  protected readonly draft$ = new BehaviorSubject<InventoryFilters>(this.data.filters);

  protected clear(): void {
    this.draft$.next(defaultFilters());
  }

  protected apply(): void {
    this.dialogRef.close(this.draft$.value);
  }
}
