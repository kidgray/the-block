import { z } from 'zod';
import { AuctionStateSchema, AuctionStatusSchema } from './auction.js';
import {
  DEFAULT_STATUS_FILTER,
  DEFAULT_VEHICLE_SORT,
  TITLE_STATUSES,
  VEHICLE_SORTS,
} from './constants.js';

export const TitleStatusSchema = z.enum(TITLE_STATUSES);

export const VehicleSummarySchema = z.object({
  id: z.string(),
  lot: z.string(),
  year: z.int(),
  make: z.string(),
  model: z.string(),
  trim: z.string(),
  bodyStyle: z.string(),
  odometerKm: z.int().nonnegative(),
  city: z.string(),
  province: z.string(),
  conditionGrade: z.number(),
  titleStatus: TitleStatusSchema,
  thumbnailUrl: z.string(),
  /** Present only when the viewer is signed in. */
  isFavorite: z.boolean().optional(),
  auction: AuctionStateSchema,
});
export type VehicleSummary = z.infer<typeof VehicleSummarySchema>;

export const VehicleDetailSchema = VehicleSummarySchema.extend({
  vin: z.string(),
  exteriorColor: z.string(),
  interiorColor: z.string(),
  engine: z.string(),
  transmission: z.string(),
  drivetrain: z.string(),
  fuelType: z.string(),
  conditionReport: z.string(),
  damageNotes: z.array(z.string()),
  images: z.array(z.string()),
  sellingDealership: z.string(),
});
export type VehicleDetail = z.infer<typeof VehicleDetailSchema>;

export const VehicleListResponseSchema = z.object({
  items: z.array(VehicleSummarySchema),
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});
export type VehicleListResponse = z.infer<typeof VehicleListResponseSchema>;

export const VehicleSortSchema = z.enum(VEHICLE_SORTS);

/** Query strings repeat a key for multiple values (`status=live&status=ended`); one value arrives as a string. */
const asArray = (value: unknown) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

const repeatable = <T extends z.ZodType>(item: T) =>
  z.preprocess(asArray, z.array(item).min(1).max(50)).optional();
const facetValue = z.string().trim().min(1).max(50);
const year = z.coerce.number().int().min(1900).max(2100);
const price = z.coerce.number().int().nonnegative();

/** `GET /api/vehicles` query parameters (design §12.3). */
export const ListVehiclesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.preprocess(
    asArray,
    z
      .array(AuctionStatusSchema)
      .min(1)
      .default(() => [...DEFAULT_STATUS_FILTER]),
  ),
  make: repeatable(facetValue),
  bodyStyle: repeatable(facetValue),
  province: repeatable(facetValue),
  titleStatus: repeatable(TitleStatusSchema),
  yearMin: year.optional(),
  yearMax: year.optional(),
  /** The current price: the current bid, or the starting bid before any bids. */
  priceMin: price.optional(),
  priceMax: price.optional(),
  gradeMin: z.coerce.number().min(0).max(5).optional(),
  /** Only vehicles where Buy Now is currently offered. */
  buyNow: z
    .literal('true')
    .transform(() => true as const)
    .optional(),
  sort: VehicleSortSchema.default(DEFAULT_VEHICLE_SORT),
  page: z.coerce.number().int().min(1).default(1),
});
export type ListVehiclesQuery = z.infer<typeof ListVehiclesQuerySchema>;

/** `GET /api/vehicles/facets`: the values the multi-select filters offer, taken from the inventory. */
export const VehicleFacetsSchema = z.object({
  makes: z.array(z.string()),
  bodyStyles: z.array(z.string()),
  provinces: z.array(z.string()),
});
export type VehicleFacets = z.infer<typeof VehicleFacetsSchema>;
