import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { VehicleFacets } from '@the-block/shared';
import {
  defaultFilters,
  type InventoryFilters,
} from '../../shared/inventory-query/inventory-query';
import { FiltersDrawer, type FiltersDrawerData } from './filters-drawer';

const FACETS: VehicleFacets = { makes: ['Ford'], bodyStyles: ['truck'], provinces: ['Alberta'] };

describe('FiltersDrawer', () => {
  let element: HTMLElement;
  let close: ReturnType<typeof vi.fn>;

  async function render(filters: InventoryFilters): Promise<void> {
    close = vi.fn();
    const data: FiltersDrawerData = { filters, facets: FACETS };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(FiltersDrawer);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function button(label: string): HTMLButtonElement {
    return [...element.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    )!;
  }

  const changed = (): InventoryFilters => ({
    ...defaultFilters(),
    status: ['ended'],
    makes: ['Ford'],
    sort: 'priceAsc',
  });

  it('applies the filters it was opened with when nothing changes', async () => {
    await render(changed());
    button('Apply').click();
    expect(close).toHaveBeenCalledWith(changed());
  });

  it('"Clear all" resets to the defaults, which apply only on "Apply"', async () => {
    await render(changed());

    button('Clear all').click();
    expect(close).not.toHaveBeenCalled();

    button('Apply').click();
    expect(close).toHaveBeenCalledWith(defaultFilters());
  });

  it('passes the filter values to the panel', async () => {
    await render(changed());
    expect(element.textContent).toContain('Make');
  });
});
