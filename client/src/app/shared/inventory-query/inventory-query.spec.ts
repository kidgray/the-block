import { convertToParamMap } from '@angular/router';
import {
  activeFilterCount,
  defaultFilters,
  filterParams,
  filtersOf,
  type InventoryFilters,
  parseInventoryQuery,
  toListQuery,
} from './inventory-query';

const filters = (overrides: Partial<InventoryFilters> = {}): InventoryFilters => ({
  ...defaultFilters(),
  ...overrides,
});

describe('parseInventoryQuery', () => {
  it('uses the defaults for an empty URL', () => {
    expect(parseInventoryQuery(convertToParamMap({}))).toEqual({
      ...defaultFilters(),
      q: '',
      page: 1,
    });
  });

  it('reads repeated status values in canonical order and ignores unknown ones', () => {
    const query = parseInventoryQuery(
      convertToParamMap({
        status: ['ended', 'bogus', 'live'],
        sort: 'priceAsc',
        page: '3',
        q: ' civic ',
      }),
    );
    expect(query).toMatchObject({
      q: 'civic',
      status: ['live', 'ended'],
      sort: 'priceAsc',
      page: 3,
    });
  });

  it('falls back on invalid sort and page values', () => {
    const query = parseInventoryQuery(convertToParamMap({ sort: 'cheapest', page: '-2' }));
    expect(query.sort).toBe('endingSoon');
    expect(query.page).toBe(1);
  });

  it('reads every filter', () => {
    const query = parseInventoryQuery(
      convertToParamMap({
        make: ['Ford', 'Toyota', 'Ford'],
        bodyStyle: 'SUV',
        province: ['Alberta'],
        titleStatus: ['salvage', 'wrecked', 'rebuilt'],
        yearMin: '2018',
        yearMax: '2022',
        priceMin: '5000',
        priceMax: '30000',
        gradeMin: '3.5',
        buyNow: 'true',
      }),
    );
    expect(filtersOf(query)).toEqual(
      filters({
        makes: ['Ford', 'Toyota'],
        bodyStyles: ['SUV'],
        provinces: ['Alberta'],
        titleStatuses: ['rebuilt', 'salvage'],
        yearMin: 2018,
        yearMax: 2022,
        priceMin: 5000,
        priceMax: 30000,
        gradeMin: 3.5,
        buyNow: true,
      }),
    );
  });

  it('ignores invalid numbers rather than failing', () => {
    const query = parseInventoryQuery(
      convertToParamMap({
        yearMin: '20x',
        yearMax: '1500',
        priceMin: '-1',
        gradeMin: '7',
        buyNow: 'yes',
      }),
    );
    expect(query).toMatchObject({
      yearMin: null,
      yearMax: null,
      priceMin: null,
      gradeMin: null,
      buyNow: false,
    });
  });
});

describe('filterParams', () => {
  it('leaves defaults out of the URL and restarts paging', () => {
    const params = filterParams(filters({ status: ['upcoming', 'live'] }));
    expect(Object.values(params).every((value) => value === null)).toBe(true);
    expect(params).toHaveProperty('page', null);
  });

  it('writes non-default values', () => {
    expect(
      filterParams(
        filters({
          status: ['ended'],
          makes: ['Ford'],
          titleStatuses: ['salvage'],
          yearMin: 2018,
          gradeMin: 4,
          buyNow: true,
          sort: 'yearDesc',
        }),
      ),
    ).toMatchObject({
      status: ['ended'],
      make: ['Ford'],
      titleStatus: ['salvage'],
      yearMin: 2018,
      yearMax: null,
      gradeMin: 4,
      buyNow: 'true',
      sort: 'yearDesc',
      page: null,
    });
  });
});

describe('activeFilterCount', () => {
  it('counts each active filter once, but not the sort', () => {
    expect(activeFilterCount(filters({ sort: 'priceDesc' }))).toBe(0);
    expect(activeFilterCount(filters({ status: ['live'] }))).toBe(1);
    expect(
      activeFilterCount(
        filters({ makes: ['Ford', 'Kia'], priceMin: 1000, priceMax: 5000, buyNow: true }),
      ),
    ).toBe(3);
  });
});

describe('toListQuery', () => {
  it('omits an empty search and unset filters', () => {
    const query = toListQuery({ ...filters(), q: '', page: 2 });
    expect(query).toEqual({
      q: undefined,
      status: ['live', 'upcoming'],
      make: undefined,
      bodyStyle: undefined,
      province: undefined,
      titleStatus: undefined,
      yearMin: undefined,
      yearMax: undefined,
      priceMin: undefined,
      priceMax: undefined,
      gradeMin: undefined,
      buyNow: undefined,
      sort: 'endingSoon',
      page: 2,
    });
  });

  it('maps the filters onto the API parameters', () => {
    const query = toListQuery({
      ...filters({ makes: ['Ford'], priceMax: 9000, buyNow: true }),
      q: 'f-150',
      page: 1,
    });
    expect(query).toMatchObject({ q: 'f-150', make: ['Ford'], priceMax: 9000, buyNow: true });
  });
});
