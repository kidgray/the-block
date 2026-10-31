import type { AuctionState, VehicleDetail, VehicleSummary } from '@the-block/shared';
import {
  auctionOutcome,
  auctionStatus,
  buyNowAvailable,
  minNextBid,
  reserveStatus,
} from '../domain/auction.js';
import type { VehicleRecord } from '../repositories/vehicle-repository.js';

/** Who is looking at an auction: null for signed-out viewers. */
export type Viewer = { userId: string; hasBid: boolean } | null;

/** Who is looking at a vehicle card or detail page, which also shows the favorite toggle (design §7.6). */
export type ListingViewer = { userId: string; hasBid: boolean; isFavorite: boolean } | null;

/**
 * Explicit DTO mapping (design §11.4). `reservePrice` is deliberately never copied:
 * buyers only ever see `reserveStatus`.
 */
export function toAuctionState(vehicle: VehicleRecord, viewer: Viewer, now: number): AuctionState {
  const status = auctionStatus(vehicle, now);
  return {
    status,
    auctionStart: new Date(vehicle.auctionStart).toISOString(),
    auctionEnd: new Date(vehicle.auctionEnd).toISOString(),
    startingBid: vehicle.startingBid,
    currentBid: vehicle.currentBid,
    bidCount: vehicle.bidCount,
    minNextBid: status === 'ended' ? null : minNextBid(vehicle),
    reserveStatus: reserveStatus(vehicle),
    buyNowPrice: vehicle.buyNowPrice,
    buyNowAvailable: buyNowAvailable(vehicle, now),
    outcome: auctionOutcome(vehicle, now),
    viewer: viewer && {
      isHighBidder: vehicle.highBidderId === viewer.userId,
      hasBid: viewer.hasBid,
      purchased: vehicle.buyNowBuyerId === viewer.userId,
    },
    version: vehicle.version,
    serverTime: new Date(now).toISOString(),
  };
}

export function toVehicleSummary(
  vehicle: VehicleRecord,
  viewer: ListingViewer,
  now: number,
): VehicleSummary {
  return {
    id: vehicle.id,
    lot: vehicle.lot,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    bodyStyle: vehicle.bodyStyle,
    odometerKm: vehicle.odometerKm,
    city: vehicle.city,
    province: vehicle.province,
    conditionGrade: vehicle.conditionGrade,
    titleStatus: vehicle.titleStatus,
    thumbnailUrl: vehicle.images[0] ?? '',
    ...(viewer && { isFavorite: viewer.isFavorite }),
    auction: toAuctionState(
      vehicle,
      viewer && { userId: viewer.userId, hasBid: viewer.hasBid },
      now,
    ),
  };
}

export function toVehicleDetail(
  vehicle: VehicleRecord,
  viewer: ListingViewer,
  now: number,
): VehicleDetail {
  return {
    ...toVehicleSummary(vehicle, viewer, now),
    vin: vehicle.vin,
    exteriorColor: vehicle.exteriorColor,
    interiorColor: vehicle.interiorColor,
    engine: vehicle.engine,
    transmission: vehicle.transmission,
    drivetrain: vehicle.drivetrain,
    fuelType: vehicle.fuelType,
    conditionReport: vehicle.conditionReport,
    damageNotes: vehicle.damageNotes,
    images: vehicle.images,
    sellingDealership: vehicle.sellingDealership,
  };
}
