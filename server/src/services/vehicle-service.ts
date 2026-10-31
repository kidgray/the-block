import {
  VEHICLES_PAGE_SIZE,
  type AuctionState,
  type ListVehiclesQuery,
  type MyBidRow,
  type MyBidsResponse,
  type User,
  type VehicleDetail,
  type VehicleFacets,
  type VehicleListResponse,
  type VehicleSummary,
} from '@the-block/shared';
import type { AuctionClock } from '../clock.js';
import { auctionPrice, auctionStatus } from '../domain/auction.js';
import { isActiveMyBidStatus, myBidStatus } from '../domain/my-bids.js';
import { parseSearchTerms } from '../domain/search.js';
import { problemError } from '../problems.js';
import type { BidRepository } from '../repositories/bid-repository.js';
import type { FavoriteRepository } from '../repositories/favorite-repository.js';
import type { VehicleRecord, VehicleRepository } from '../repositories/vehicle-repository.js';
import { toAuctionState, toVehicleDetail, toVehicleSummary } from './views.js';

export class VehicleService {
  constructor(
    private readonly vehicles: VehicleRepository,
    private readonly bids: BidRepository,
    private readonly favorites: FavoriteRepository,
    private readonly clock: AuctionClock,
  ) {}

  list(query: ListVehiclesQuery, user: User | null): VehicleListResponse {
    const now = this.clock.now();
    const { records, total } = this.vehicles.search({
      terms: parseSearchTerms(query.q),
      statuses: query.status,
      makes: query.make,
      bodyStyles: query.bodyStyle,
      provinces: query.province,
      titleStatuses: query.titleStatus,
      yearMin: query.yearMin,
      yearMax: query.yearMax,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      gradeMin: query.gradeMin,
      buyNowOnly: query.buyNow,
      sort: query.sort,
      limit: VEHICLES_PAGE_SIZE,
      offset: (query.page - 1) * VEHICLES_PAGE_SIZE,
      now,
    });
    return {
      items: this.summaries(records, user, now),
      total,
      page: query.page,
      pageSize: VEHICLES_PAGE_SIZE,
    };
  }

  facets(): VehicleFacets {
    return this.vehicles.facets();
  }

  get(vehicleId: string, user: User | null): VehicleDetail {
    const vehicle = this.requireVehicle(vehicleId);
    const viewer = user && {
      userId: user.id,
      hasBid: this.bids.hasBid(user.id, vehicle.id),
      isFavorite: this.favorites.isFavorite(user.id, vehicle.id),
    };
    return toVehicleDetail(vehicle, viewer, this.clock.now());
  }

  /** One auction snapshot for one viewer: what each SSE event carries (design §6.1). */
  auctionState(vehicleId: string, user: User | null): AuctionState {
    const vehicle = this.requireVehicle(vehicleId);
    const viewer = user && { userId: user.id, hasBid: this.bids.hasBid(user.id, vehicle.id) };
    return toAuctionState(vehicle, viewer, this.clock.now());
  }

  /** The buyer's favorites, in the inventory's default order: ending soonest, ended last (design §7.6). */
  favoritesOf(user: User): VehicleSummary[] {
    const now = this.clock.now();
    const records = this.vehicles.findFavoritedBy(user.id).sort((a, b) => {
      const aEnded = auctionStatus(a, now) === 'ended';
      const bEnded = auctionStatus(b, now) === 'ended';
      if (aEnded !== bEnded) return aEnded ? 1 : -1;
      return aEnded ? b.auctionEnd - a.auctionEnd : a.auctionEnd - b.auctionEnd;
    });
    return this.summaries(records, user, now);
  }

  addFavorite(user: User, vehicleId: string): void {
    this.requireVehicle(vehicleId);
    this.favorites.add(user.id, vehicleId);
  }

  removeFavorite(user: User, vehicleId: string): void {
    this.requireVehicle(vehicleId);
    this.favorites.remove(user.id, vehicleId);
  }

  /** Design §7.5: Active rows end soonest first; Ended rows are most recent first. */
  myBids(user: User): MyBidsResponse {
    const now = this.clock.now();
    const records = this.vehicles.findBidOnOrBoughtBy(user.id);
    const favorited = this.favorites.vehicleIdsFavoritedBy(
      user.id,
      records.map(({ vehicle }) => vehicle.id),
    );
    const rows = records.map(({ vehicle, myHighestBid }) => {
      const viewer = {
        userId: user.id,
        hasBid: myHighestBid !== null,
        isFavorite: favorited.has(vehicle.id),
      };
      const row: MyBidRow = {
        vehicle: toVehicleSummary(vehicle, viewer, now),
        myHighestBid,
        price: auctionPrice(vehicle),
        status: myBidStatus(vehicle, user.id, now),
      };
      return { row, end: vehicle.auctionEnd };
    });

    const active = rows.filter(({ row }) => isActiveMyBidStatus(row.status));
    const ended = rows.filter(({ row }) => !isActiveMyBidStatus(row.status));
    return {
      active: active.sort((a, b) => a.end - b.end).map(({ row }) => row),
      ended: ended.sort((a, b) => b.end - a.end).map(({ row }) => row),
    };
  }

  /** Cards for many vehicles, with the viewer's bid and favorite flags looked up in two queries. */
  private summaries(records: VehicleRecord[], user: User | null, now: number): VehicleSummary[] {
    if (!user) return records.map((record) => toVehicleSummary(record, null, now));
    const ids = records.map((record) => record.id);
    const bidOn = this.bids.vehicleIdsBidOnBy(user.id, ids);
    const favorited = this.favorites.vehicleIdsFavoritedBy(user.id, ids);
    return records.map((record) =>
      toVehicleSummary(
        record,
        { userId: user.id, hasBid: bidOn.has(record.id), isFavorite: favorited.has(record.id) },
        now,
      ),
    );
  }

  private requireVehicle(vehicleId: string): VehicleRecord {
    const vehicle = this.vehicles.findById(vehicleId);
    if (!vehicle) throw problemError(404, 'VEHICLE_NOT_FOUND', 'There is no vehicle with that ID.');
    return vehicle;
  }
}
