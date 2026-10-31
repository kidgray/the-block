import type { ParamMap, Params } from '@angular/router';
import {
  AUCTION_STATUSES,
  DEFAULT_STATUS_FILTER,
  DEFAULT_VEHICLE_SORT,
  TITLE_STATUSES,
  VEHICLE_SORTS,
  type AuctionStatus,
  type ListVehiclesQuery,
  type TitleStatus,
  type VehicleSort,
} from '@the-block/shared';

/** The filters and sort of design §7.1. Empty lists and null bounds mean "not filtered". */
export interface InventoryFilters {
  status: AuctionStatus[];
  makes: string[];
  bodyStyles: string[];
  provinces: string[];
  titleStatuses: TitleStatus[];
  yearMin: number | null;
  yearMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  gradeMin: number | null;
  buyNow: boolean;
  sort: VehicleSort;
}

/** The inventory view, parsed from the URL: the single source of truth for search state (design §7.1). */
export interface InventoryQuery extends InventoryFilters {
  q: string;
  page: number;
}

export function defaultFilters(): InventoryFilters {
  return {
    status: [...DEFAULT_STATUS_FILTER],
    makes: [],
    bodyStyles: [],
    provinces: [],
    titleStatuses: [],
    yearMin: null,
    yearMax: null,
    priceMin: null,
    priceMax: null,
    gradeMin: null,
    buyNow: false,
    sort: DEFAULT_VEHICLE_SORT,
  };
}

/** Reads the URL leniently: anything invalid falls back to "not filtered" rather than failing. */
export function parseInventoryQuery(params: ParamMap): InventoryQuery {
  const status = AUCTION_STATUSES.filter((value) => params.getAll('status').includes(value));
  const sort = params.get('sort');
  const page = Number(params.get('page') ?? 1);
  return {
    q: (params.get('q') ?? '').trim(),
    status: status.length > 0 ? status : [...DEFAULT_STATUS_FILTER],
    makes: textList(params, 'make'),
    bodyStyles: textList(params, 'bodyStyle'),
    provinces: textList(params, 'province'),
    titleStatuses: TITLE_STATUSES.filter((value) => params.getAll('titleStatus').includes(value)),
    yearMin: numberParam(params, 'yearMin', { min: 1900, max: 2100, integer: true }),
    yearMax: numberParam(params, 'yearMax', { min: 1900, max: 2100, integer: true }),
    priceMin: numberParam(params, 'priceMin', { min: 0, integer: true }),
    priceMax: numberParam(params, 'priceMax', { min: 0, integer: true }),
    gradeMin: numberParam(params, 'gradeMin', { min: 0, max: 5 }),
    buyNow: params.get('buyNow') === 'true',
    sort: isSort(sort) ? sort : DEFAULT_VEHICLE_SORT,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export function toListQuery(query: InventoryQuery): ListVehiclesQuery {
  const list = <T>(values: T[]) => (values.length > 0 ? values : undefined);
  const bound = (value: number | null) => value ?? undefined;
  return {
    q: query.q || undefined,
    status: query.status,
    make: list(query.makes),
    bodyStyle: list(query.bodyStyles),
    province: list(query.provinces),
    titleStatus: list(query.titleStatuses),
    yearMin: bound(query.yearMin),
    yearMax: bound(query.yearMax),
    priceMin: bound(query.priceMin),
    priceMax: bound(query.priceMax),
    gradeMin: bound(query.gradeMin),
    buyNow: query.buyNow || undefined,
    sort: query.sort,
    page: query.page,
  };
}

export function filtersOf(query: InventoryQuery): InventoryFilters {
  return {
    status: query.status,
    makes: query.makes,
    bodyStyles: query.bodyStyles,
    provinces: query.provinces,
    titleStatuses: query.titleStatuses,
    yearMin: query.yearMin,
    yearMax: query.yearMax,
    priceMin: query.priceMin,
    priceMax: query.priceMax,
    gradeMin: query.gradeMin,
    buyNow: query.buyNow,
    sort: query.sort,
  };
}

/** URL parameters for a filter change: defaults are left out of the URL, and paging restarts. */
export function filterParams(filters: InventoryFilters): Params {
  const list = (values: readonly string[]) => (values.length > 0 ? values : null);
  return {
    status: isDefaultStatus(filters.status) ? null : filters.status,
    make: list(filters.makes),
    bodyStyle: list(filters.bodyStyles),
    province: list(filters.provinces),
    titleStatus: list(filters.titleStatuses),
    yearMin: filters.yearMin,
    yearMax: filters.yearMax,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    gradeMin: filters.gradeMin,
    buyNow: filters.buyNow ? 'true' : null,
    sort: filters.sort === DEFAULT_VEHICLE_SORT ? null : filters.sort,
    page: null,
  };
}

/** How many filters differ from the defaults; a range counts once, and sorting is not a filter. */
export function activeFilterCount(filters: InventoryFilters): number {
  return [
    !isDefaultStatus(filters.status),
    filters.makes.length > 0,
    filters.bodyStyles.length > 0,
    filters.provinces.length > 0,
    filters.titleStatuses.length > 0,
    filters.yearMin !== null || filters.yearMax !== null,
    filters.priceMin !== null || filters.priceMax !== null,
    filters.gradeMin !== null,
    filters.buyNow,
  ].filter(Boolean).length;
}

function textList(params: ParamMap, key: string): string[] {
  const values = params.getAll(key).map((value) => value.trim());
  return [...new Set(values.filter((value) => value.length > 0 && value.length <= 50))];
}

function numberParam(
  params: ParamMap,
  key: string,
  {
    min,
    max = Number.MAX_SAFE_INTEGER,
    integer = false,
  }: { min: number; max?: number; integer?: boolean },
): number | null {
  const raw = params.get(key)?.trim();
  if (!raw) return null;
  const value = Number(raw);
  const valid = Number.isFinite(value) && value >= min && value <= max;
  return valid && (!integer || Number.isInteger(value)) ? value : null;
}

function isDefaultStatus(status: readonly AuctionStatus[]): boolean {
  return (
    status.length === DEFAULT_STATUS_FILTER.length &&
    DEFAULT_STATUS_FILTER.every((value) => status.includes(value))
  );
}

function isSort(value: string | null): value is VehicleSort {
  return (VEHICLE_SORTS as readonly (string | null)[]).includes(value);
}
