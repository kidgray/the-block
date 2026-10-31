// Plain values and types with no Zod import, so the client can use them without bundling Zod
// (the package is marked side-effect free, letting bundlers drop the schema modules).

/** Sanity limit on a single bid; larger amounts are almost always typos (design §8.3). */
export const MAX_BID_AMOUNT = 1_000_000;

/** Fixed page size for the inventory list: fills complete rows at 2, 3, and 4 columns (design §7.1). */
export const VEHICLES_PAGE_SIZE = 24;

export const AUCTION_STATUSES = ['upcoming', 'live', 'ended'] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export const TITLE_STATUSES = ['clean', 'rebuilt', 'salvage'] as const;
export type TitleStatus = (typeof TITLE_STATUSES)[number];

export const VEHICLE_SORTS = [
  'endingSoon',
  'priceAsc',
  'priceDesc',
  'yearDesc',
  'odometerAsc',
] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export const DEFAULT_STATUS_FILTER: readonly AuctionStatus[] = ['live', 'upcoming'];
export const DEFAULT_VEHICLE_SORT: VehicleSort = 'endingSoon';

/** The buyer's position in an auction they took part in (design §7.5). */
export const MY_BID_STATUSES = [
  'winning',
  'outbid',
  'won',
  'lost',
  'reserve_not_met',
  'purchased',
] as const;
export type MyBidStatus = (typeof MY_BID_STATUSES)[number];
