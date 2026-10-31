import type { AuctionStatus, TitleStatus, VehicleSort } from '@the-block/shared';
import type { Db } from '../db/connection.js';
import type { AuctionFacts } from '../domain/auction.js';

export interface VehicleRecord extends AuctionFacts {
  id: string;
  vin: string;
  lot: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  exteriorColor: string;
  interiorColor: string;
  engine: string;
  transmission: string;
  drivetrain: string;
  fuelType: string;
  odometerKm: number;
  conditionGrade: number;
  conditionReport: string;
  damageNotes: string[];
  titleStatus: TitleStatus;
  city: string;
  province: string;
  sellingDealership: string;
  images: string[];
  version: number;
}

/** The filters of design §7.1. Every filter that is set must match. */
export interface VehicleFilters {
  makes?: string[];
  bodyStyles?: string[];
  provinces?: string[];
  titleStatuses?: TitleStatus[];
  yearMin?: number;
  yearMax?: number;
  /** Bounds on the current price: the current bid, or the starting bid before any bids. */
  priceMin?: number;
  priceMax?: number;
  gradeMin?: number;
  /** Only vehicles where Buy Now is currently offered (design §8.5). */
  buyNowOnly?: boolean;
}

export interface VehicleSearch extends VehicleFilters {
  /** Every term must match at least one of year, make, model, trim, VIN, or lot (design §7.1). */
  terms: string[];
  statuses: AuctionStatus[];
  sort: VehicleSort;
  limit: number;
  offset: number;
  now: number;
}

export interface VehicleFacetValues {
  makes: string[];
  bodyStyles: string[];
  provinces: string[];
}

/** An auction that starts or ends at a given moment (design §8.4). */
export interface StatusChange {
  vehicleId: string;
  status: 'live' | 'ended';
}

/** A vehicle the user bid on or bought, with the user's highest bid (null if they only bought it). */
export interface BuyerAuctionRecord {
  vehicle: VehicleRecord;
  myHighestBid: number | null;
}

interface VehicleRow {
  id: string;
  vin: string;
  lot: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_style: string;
  exterior_color: string;
  interior_color: string;
  engine: string;
  transmission: string;
  drivetrain: string;
  fuel_type: string;
  odometer_km: number;
  condition_grade: number;
  condition_report: string;
  damage_notes: string;
  title_status: TitleStatus;
  city: string;
  province: string;
  selling_dealership: string;
  images: string;
  starting_bid: number;
  reserve_price: number | null;
  buy_now_price: number | null;
  current_bid: number | null;
  bid_count: number;
  high_bidder_id: string | null;
  auction_start: number;
  auction_end: number;
  buy_now_buyer_id: string | null;
  version: number;
}

/** Mirrors `auctionStatus()` in domain/auction.ts so status can be filtered and sorted in SQL. */
const STATUS_SQL = `CASE
  WHEN buy_now_buyer_id IS NOT NULL OR auction_end <= @now THEN 'ended'
  WHEN auction_start > @now THEN 'upcoming'
  ELSE 'live'
END`;

const ORDER_BY: Record<VehicleSort, string> = {
  endingSoon: `(status = 'ended'), CASE WHEN status = 'ended' THEN -auction_end ELSE auction_end END, lot`,
  priceAsc: 'price ASC, lot',
  priceDesc: 'price DESC, lot',
  yearDesc: 'year DESC, lot',
  odometerAsc: 'odometer_km ASC, lot',
};

const SEARCHABLE_COLUMNS = ['CAST(year AS TEXT)', 'make', 'model', 'trim', 'vin', 'lot'];

export class VehicleRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): VehicleRecord | undefined {
    const row = this.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as
      VehicleRow | undefined;
    return row && toRecord(row);
  }

  findAll(): VehicleRecord[] {
    return (this.db.prepare('SELECT * FROM vehicles').all() as VehicleRow[]).map(toRecord);
  }

  /** The user's favorite vehicles (design §7.6). */
  findFavoritedBy(userId: string): VehicleRecord[] {
    const rows = this.db
      .prepare(
        `SELECT v.* FROM vehicles v JOIN favorites f ON f.vehicle_id = v.id WHERE f.user_id = ?`,
      )
      .all(userId) as VehicleRow[];
    return rows.map(toRecord);
  }

  /**
   * The earliest auction start or end after `time`, or null when every auction has ended.
   * Vehicles bought through Buy Now have already ended.
   */
  nextStatusChangeAfter(time: number): number | null {
    return this.db
      .prepare(
        `SELECT MIN(moment) FROM (
           SELECT auction_start AS moment FROM vehicles WHERE buy_now_buyer_id IS NULL AND auction_start > @time
           UNION ALL
           SELECT auction_end FROM vehicles WHERE buy_now_buyer_id IS NULL AND auction_end > @time
         )`,
      )
      .pluck()
      .get({ time }) as number | null;
  }

  /** Auctions that went live or ended in the window (from, to]. An auction that did both has ended. */
  statusChangesBetween(from: number, to: number): StatusChange[] {
    return this.db
      .prepare(
        `SELECT id AS vehicleId,
                CASE WHEN auction_end > @from AND auction_end <= @to THEN 'ended' ELSE 'live' END AS status
         FROM vehicles
         WHERE buy_now_buyer_id IS NULL
           AND ((auction_start > @from AND auction_start <= @to) OR (auction_end > @from AND auction_end <= @to))
         ORDER BY vehicleId`,
      )
      .all({ from, to }) as StatusChange[];
  }

  search(criteria: VehicleSearch): { records: VehicleRecord[]; total: number } {
    const params: Record<string, string | number> = {
      now: criteria.now,
      limit: criteria.limit,
      offset: criteria.offset,
    };
    const conditions: string[] = [];

    /** `column IN (@name0, @name1, …)`, binding each value as its own parameter. */
    const inList = (column: string, name: string, values: readonly string[]) => {
      const placeholders = values.map((value, index) => {
        params[`${name}${index}`] = value;
        return `@${name}${index}`;
      });
      conditions.push(`${column} IN (${placeholders.join(', ')})`);
    };
    /** `column <op> @name`, only when a bound is given. */
    const bound = (column: string, op: '>=' | '<=', name: string, value: number | undefined) => {
      if (value === undefined) return;
      params[name] = value;
      conditions.push(`${column} ${op} @${name}`);
    };

    inList('status', 'status', criteria.statuses);
    if (criteria.makes?.length) inList('make', 'make', criteria.makes);
    if (criteria.bodyStyles?.length) inList('body_style', 'bodyStyle', criteria.bodyStyles);
    if (criteria.provinces?.length) inList('province', 'province', criteria.provinces);
    if (criteria.titleStatuses?.length) {
      inList('title_status', 'titleStatus', criteria.titleStatuses);
    }
    bound('year', '>=', 'yearMin', criteria.yearMin);
    bound('year', '<=', 'yearMax', criteria.yearMax);
    bound('price', '>=', 'priceMin', criteria.priceMin);
    bound('price', '<=', 'priceMax', criteria.priceMax);
    bound('condition_grade', '>=', 'gradeMin', criteria.gradeMin);
    // Mirrors `buyNowAvailable()` in domain/auction.ts.
    if (criteria.buyNowOnly) {
      conditions.push(
        `(buy_now_price IS NOT NULL AND status = 'live' AND (current_bid IS NULL OR current_bid < buy_now_price))`,
      );
    }

    criteria.terms.forEach((term, index) => {
      params[`term${index}`] = `%${escapeLike(term)}%`;
      const matches = SEARCHABLE_COLUMNS.map(
        (column) => `${column} LIKE @term${index} ESCAPE '\\'`,
      );
      conditions.push(`(${matches.join(' OR ')})`);
    });

    const filtered = `
      WITH v AS (
        SELECT *, ${STATUS_SQL} AS status, COALESCE(current_bid, starting_bid) AS price FROM vehicles
      )
      SELECT * FROM v WHERE ${conditions.join(' AND ')}`;

    const total = this.db
      .prepare(`SELECT COUNT(*) FROM (${filtered})`)
      .pluck()
      .get(params) as number;
    const rows = this.db
      .prepare(`${filtered} ORDER BY ${ORDER_BY[criteria.sort]} LIMIT @limit OFFSET @offset`)
      .all(params) as VehicleRow[];
    return { records: rows.map(toRecord), total };
  }

  /** Distinct values for the multi-select filters, sorted alphabetically. */
  facets(): VehicleFacetValues {
    const distinct = (column: string) =>
      this.db
        .prepare(`SELECT DISTINCT ${column} FROM vehicles ORDER BY ${column} COLLATE NOCASE`)
        .pluck()
        .all() as string[];
    return {
      makes: distinct('make'),
      bodyStyles: distinct('body_style'),
      provinces: distinct('province'),
    };
  }

  /** Every vehicle the user bid on or bought through Buy Now, in one query (design §7.5). */
  findBidOnOrBoughtBy(userId: string): BuyerAuctionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT v.*, mine.highest AS my_highest_bid
         FROM vehicles v
         LEFT JOIN (
           SELECT vehicle_id, MAX(amount) AS highest FROM bids WHERE user_id = @userId GROUP BY vehicle_id
         ) mine ON mine.vehicle_id = v.id
         WHERE mine.vehicle_id IS NOT NULL OR v.buy_now_buyer_id = @userId`,
      )
      .all({ userId }) as (VehicleRow & { my_highest_bid: number | null })[];
    return rows.map((row) => ({ vehicle: toRecord(row), myHighestBid: row.my_highest_bid }));
  }

  recordAcceptedBid(id: string, amount: number, bidderId: string): void {
    this.db
      .prepare(
        `UPDATE vehicles
         SET current_bid = ?, bid_count = bid_count + 1, high_bidder_id = ?, version = version + 1
         WHERE id = ?`,
      )
      .run(amount, bidderId, id);
  }

  /** A Buy Now purchase ends the auction at once as a sale to the buyer (design §8.5, §11.2). */
  recordBuyNow(id: string, buyerId: string, now: number): void {
    this.db
      .prepare(
        `UPDATE vehicles
         SET buy_now_buyer_id = ?, auction_end = ?, version = version + 1
         WHERE id = ?`,
      )
      .run(buyerId, now, id);
  }
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function toRecord(row: VehicleRow): VehicleRecord {
  return {
    id: row.id,
    vin: row.vin,
    lot: row.lot,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    bodyStyle: row.body_style,
    exteriorColor: row.exterior_color,
    interiorColor: row.interior_color,
    engine: row.engine,
    transmission: row.transmission,
    drivetrain: row.drivetrain,
    fuelType: row.fuel_type,
    odometerKm: row.odometer_km,
    conditionGrade: row.condition_grade,
    conditionReport: row.condition_report,
    damageNotes: JSON.parse(row.damage_notes) as string[],
    titleStatus: row.title_status,
    city: row.city,
    province: row.province,
    sellingDealership: row.selling_dealership,
    images: JSON.parse(row.images) as string[],
    startingBid: row.starting_bid,
    reservePrice: row.reserve_price,
    buyNowPrice: row.buy_now_price,
    currentBid: row.current_bid,
    bidCount: row.bid_count,
    highBidderId: row.high_bidder_id,
    auctionStart: row.auction_start,
    auctionEnd: row.auction_end,
    buyNowBuyerId: row.buy_now_buyer_id,
    version: row.version,
  };
}
