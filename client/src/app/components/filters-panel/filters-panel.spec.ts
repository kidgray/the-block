import { TestBed } from '@angular/core/testing';
import type { VehicleFacets } from '@the-block/shared';
import {
  defaultFilters,
  type InventoryFilters,
} from '../../shared/inventory-query/inventory-query';
import { FiltersPanel } from './filters-panel';

const FACETS: VehicleFacets = {
  makes: ['Ford', 'Honda'],
  bodyStyles: ['sedan', 'truck'],
  provinces: ['Alberta', 'Ontario'],
};

const filters = (overrides: Partial<InventoryFilters> = {}): InventoryFilters => ({
  ...defaultFilters(),
  ...overrides,
});

describe('FiltersPanel', () => {
  let element: HTMLElement;
  let emitted: InventoryFilters[];

  async function render(value: InventoryFilters, facets: VehicleFacets | null = FACETS) {
    const fixture = TestBed.createComponent(FiltersPanel);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('facets', facets);
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((next) => emitted.push(next));
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function checkbox(group: string, label: string): HTMLInputElement {
    const fieldset = [...element.querySelectorAll('fieldset')].find(
      (candidate) => candidate.querySelector('legend')?.textContent?.trim() === group,
    )!;
    const box = [...fieldset.querySelectorAll('mat-checkbox')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    return box!.querySelector('input')!;
  }

  function numberInput(name: string): HTMLInputElement {
    return element.querySelector<HTMLInputElement>(`input[name=${name}]`)!;
  }

  function enter(name: string, value: string): void {
    const input = numberInput(name);
    input.value = value;
    input.dispatchEvent(new Event('change'));
  }

  const selectLabels = () =>
    [...element.querySelectorAll('mat-form-field mat-label')].map((label) =>
      label.textContent?.trim(),
    );

  it('adds a status, keeping statuses in a stable order', async () => {
    await render(filters({ status: ['live'] }));
    checkbox('Auction status', 'Upcoming').click();
    expect(emitted).toEqual([filters({ status: ['upcoming', 'live'] })]);
  });

  it('removes a status', async () => {
    await render(filters({ status: ['upcoming', 'live'], sort: 'priceAsc' }));
    checkbox('Auction status', 'Live').click();
    expect(emitted).toEqual([filters({ status: ['upcoming'], sort: 'priceAsc' })]);
  });

  it('never lets the last status be unchecked', async () => {
    await render(filters({ status: ['live'] }));
    expect(checkbox('Auction status', 'Live').disabled).toBe(true);
    expect(checkbox('Auction status', 'Ended').disabled).toBe(false);
  });

  it('shows the current sort', async () => {
    await render(filters({ sort: 'priceAsc' }));
    expect(element.querySelector('mat-select')?.textContent).toContain('Price: low to high');
  });

  it('toggles title statuses in a stable order', async () => {
    await render(filters({ titleStatuses: ['salvage'] }));
    checkbox('Title status', 'Rebuilt').click();
    expect(emitted).toEqual([filters({ titleStatuses: ['rebuilt', 'salvage'] })]);
  });

  it('toggles "Buy Now available"', async () => {
    await render(filters());
    element.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.click();
    expect(emitted).toEqual([filters({ buyNow: true })]);
  });

  it('applies a year or price bound when the field changes', async () => {
    await render(filters());
    enter('yearMin', '2018');
    enter('priceMax', '25000');
    expect(emitted).toEqual([filters({ yearMin: 2018 }), filters({ priceMax: 25_000 })]);
  });

  it('clears a bound that is emptied or invalid', async () => {
    await render(filters({ yearMax: 2022 }));
    enter('yearMax', '');
    enter('yearMin', '1200');
    expect(emitted).toEqual([filters(), filters({ yearMax: 2022 })]);
    expect(numberInput('yearMin').value).toBe('');
  });

  it('shows the current bounds', async () => {
    await render(filters({ yearMin: 2018, priceMin: 5_000 }));
    expect(numberInput('yearMin').value).toBe('2018');
    expect(numberInput('priceMin').value).toBe('5000');
    expect(numberInput('priceMax').value).toBe('');
  });

  it('offers make, body style, and province once their values load', async () => {
    await render(filters(), null);
    expect(selectLabels()).not.toContain('Make');

    await render(filters({ makes: ['Ford'] }), FACETS);
    expect(selectLabels()).toEqual(
      expect.arrayContaining(['Make', 'Body style', 'Province', 'Condition grade']),
    );
    const make = [...element.querySelectorAll('mat-form-field')].find((field) =>
      field.textContent?.includes('Make'),
    );
    expect(make?.querySelector('mat-select')?.textContent).toContain('Ford');
  });

  it('shows "Any" until a minimum grade is chosen', async () => {
    await render(filters());
    const grade = [...element.querySelectorAll('mat-form-field')].find((field) =>
      field.textContent?.includes('Condition grade'),
    );
    expect(grade?.querySelector('mat-select')?.textContent).toContain('Any');
  });
});
