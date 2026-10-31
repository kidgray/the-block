import type { AuctionState, VehicleDetail, VehicleSummary } from '@the-block/shared';

const HOUR_MS = 3_600_000;

/** A live auction with no bids yet, ending an hour from now. */
export function auctionState(overrides: Partial<AuctionState> = {}): AuctionState {
  const now = Date.now();
  return {
    status: 'live',
    auctionStart: new Date(now - HOUR_MS).toISOString(),
    auctionEnd: new Date(now + HOUR_MS).toISOString(),
    startingBid: 5_500,
    currentBid: null,
    bidCount: 0,
    minNextBid: 5_500,
    reserveStatus: 'none',
    buyNowPrice: null,
    buyNowAvailable: false,
    outcome: null,
    viewer: null,
    version: 0,
    serverTime: new Date(now).toISOString(),
    ...overrides,
  };
}

export function vehicleSummary(overrides: Partial<VehicleSummary> = {}): VehicleSummary {
  return {
    id: 'v1',
    lot: 'A-0001',
    year: 2018,
    make: 'Honda',
    model: 'Pilot',
    trim: 'Touring',
    bodyStyle: 'SUV',
    odometerKm: 84_210,
    city: 'Calgary',
    province: 'AB',
    conditionGrade: 4.2,
    titleStatus: 'clean',
    thumbnailUrl: '/images/v1-thumb.jpg',
    auction: auctionState(),
    ...overrides,
  };
}

export function vehicleDetail(overrides: Partial<VehicleDetail> = {}): VehicleDetail {
  return {
    ...vehicleSummary(),
    vin: '5FNYF6H95JB000001',
    exteriorColor: 'Black',
    interiorColor: 'Grey',
    engine: '3.5L V6',
    transmission: 'automatic',
    drivetrain: 'AWD',
    fuelType: 'gasoline',
    conditionReport: 'Clean interior with light wear.',
    damageNotes: ['Scratch on rear bumper'],
    images: ['/images/v1-1.jpg', '/images/v1-2.jpg'],
    sellingDealership: 'Northside Motors',
    ...overrides,
  };
}
