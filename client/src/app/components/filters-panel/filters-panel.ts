import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  AUCTION_STATUSES,
  TITLE_STATUSES,
  type AuctionStatus,
  type TitleStatus,
  type VehicleFacets,
  type VehicleSort,
} from '@the-block/shared';
import type { InventoryFilters } from '../../shared/inventory-query/inventory-query';

const STATUS_OPTIONS: { value: AuctionStatus; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
];

const SORT_OPTIONS: { value: VehicleSort; label: string }[] = [
  { value: 'endingSoon', label: 'Ending soonest' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
  { value: 'yearDesc', label: 'Year: newest first' },
  { value: 'odometerAsc', label: 'Odometer: lowest first' },
];

const TITLE_OPTIONS: { value: TitleStatus; label: string }[] = [
  { value: 'clean', label: 'Clean' },
  { value: 'rebuilt', label: 'Rebuilt' },
  { value: 'salvage', label: 'Salvage' },
];

/** Minimum condition grades on offer; 0 means "Any". */
const GRADE_OPTIONS = [0, 1, 2, 3, 4, 4.5];

type NumberFilter = 'yearMin' | 'yearMax' | 'priceMin' | 'priceMax';

const NUMBER_BOUNDS: Record<NumberFilter, { min: number; max: number }> = {
  yearMin: { min: 1900, max: 2100 },
  yearMax: { min: 1900, max: 2100 },
  priceMin: { min: 0, max: Number.MAX_SAFE_INTEGER },
  priceMax: { min: 0, max: Number.MAX_SAFE_INTEGER },
};

/** Presentational filter controls, shared by the desktop sidebar and the mobile drawer (design §7.1, §9). */
@Component({
  selector: 'app-filters-panel',
  imports: [
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  templateUrl: './filters-panel.html',
  styleUrl: './filters-panel.scss',
})
export class FiltersPanel {
  @Input({ required: true }) value!: InventoryFilters;
  /** The values offered by the multi-select filters; those filters are hidden until they load. */
  @Input() facets: VehicleFacets | null = null;
  @Output() readonly valueChange = new EventEmitter<InventoryFilters>();

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly titleOptions = TITLE_OPTIONS;
  protected readonly gradeOptions = GRADE_OPTIONS;

  /** At least one status stays selected, so the list is never filtered down to nothing by accident. */
  protected isOnlySelected(status: AuctionStatus): boolean {
    return this.value.status.length === 1 && this.value.status[0] === status;
  }

  protected toggleStatus(status: AuctionStatus, checked: boolean): void {
    const selected = new Set(this.value.status);
    if (checked) selected.add(status);
    else selected.delete(status);
    this.patch({ status: AUCTION_STATUSES.filter((value) => selected.has(value)) });
  }

  protected toggleTitle(title: TitleStatus, checked: boolean): void {
    const selected = new Set(this.value.titleStatuses);
    if (checked) selected.add(title);
    else selected.delete(title);
    this.patch({ titleStatuses: TITLE_STATUSES.filter((value) => selected.has(value)) });
  }

  protected setSort(sort: VehicleSort): void {
    this.patch({ sort });
  }

  protected setGrade(grade: number): void {
    this.patch({ gradeMin: grade === 0 ? null : grade });
  }

  /** Applied on `change` (blur or Enter), not per keystroke. Invalid input clears the bound. */
  protected setNumber(filter: NumberFilter, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.trim();
    const value = raw === '' ? null : Number(raw);
    const { min, max } = NUMBER_BOUNDS[filter];
    const valid = value !== null && Number.isInteger(value) && value >= min && value <= max;
    if (!valid) input.value = '';
    this.patch({ [filter]: valid ? value : null });
  }

  protected patch(changes: Partial<InventoryFilters>): void {
    this.valueChange.emit({ ...this.value, ...changes });
  }
}
