import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApiTestKit, datasetVehicle, type ApiTestKit } from '../testing/api-test-kit.js';

describe('GET /api/vehicles filters', () => {
  let kit: ApiTestKit;

  beforeAll(() => {
    kit = createApiTestKit([
      datasetVehicle({ id: 'civic', lot: 'L1', make: 'Honda', model: 'Civic', year: 2019 }),
      datasetVehicle({
        id: 'f150',
        lot: 'L2',
        make: 'Ford',
        model: 'F-150',
        body_style: 'truck',
        province: 'Alberta',
        year: 2022,
        current_bid: 41_000,
        condition_grade: 2.5,
        title_status: 'rebuilt',
        buy_now_price: 48_000,
      }),
      datasetVehicle({
        id: 'rav4',
        lot: 'L3',
        make: 'Toyota',
        model: 'RAV4',
        body_style: 'SUV',
        province: 'Quebec',
        year: 2024,
        current_bid: null,
        bid_count: 0,
        starting_bid: 9_000,
        condition_grade: 4.6,
        title_status: 'salvage',
        buy_now_price: 15_000,
      }),
    ]);
    // Buy Now is offered only while live, so the RAV4 is upcoming and its Buy Now is not offered.
    kit.schedule('rav4', 'upcoming');
  });

  const ids = async (query: string) => {
    const response = await request(kit.app).get(`/api/vehicles?${query}`).expect(200);
    return (response.body.items as { id: string }[]).map((item) => item.id);
  };

  it('filters by make, body style, and province (repeatable)', async () => {
    expect(await ids('make=Ford&make=Toyota&sort=yearDesc')).toEqual(['rav4', 'f150']);
    expect(await ids('bodyStyle=truck')).toEqual(['f150']);
    expect(await ids('province=Quebec&province=Alberta&sort=yearDesc')).toEqual(['rav4', 'f150']);
  });

  it('filters by year range', async () => {
    expect(await ids('yearMin=2020&sort=yearDesc')).toEqual(['rav4', 'f150']);
    expect(await ids('yearMin=2020&yearMax=2023')).toEqual(['f150']);
  });

  it('filters by current price: the current bid, or the starting bid before any bids', async () => {
    expect(await ids('priceMax=10000')).toEqual(['rav4']);
    expect(await ids('priceMin=20000&priceMax=30000')).toEqual(['civic']);
  });

  it('filters by minimum condition grade and by title status', async () => {
    expect(await ids('gradeMin=4.5')).toEqual(['rav4']);
    expect(await ids('titleStatus=rebuilt&titleStatus=salvage&sort=yearDesc')).toEqual([
      'rav4',
      'f150',
    ]);
  });

  it('shows only vehicles where Buy Now is currently offered', async () => {
    expect(await ids('buyNow=true')).toEqual(['f150']);
  });

  it('combines filters with search and status', async () => {
    expect(await ids('q=f-150&make=Ford&status=live')).toEqual(['f150']);
    expect(await ids('make=Honda&status=upcoming')).toEqual([]);
  });

  it('rejects invalid filter values with 422', async () => {
    for (const query of ['titleStatus=wrecked', 'yearMin=old', 'gradeMin=9', 'buyNow=yes']) {
      const response = await request(kit.app).get(`/api/vehicles?${query}`).expect(422);
      expect(response.body.code, query).toBe('VALIDATION_FAILED');
    }
  });

  it('lists the filter values from the inventory', async () => {
    const response = await request(kit.app).get('/api/vehicles/facets').expect(200);
    expect(response.body).toEqual({
      makes: ['Ford', 'Honda', 'Toyota'],
      bodyStyles: ['sedan', 'SUV', 'truck'],
      provinces: ['Alberta', 'Ontario', 'Quebec'],
    });
  });

  it('answers unknown API paths with a JSON 404', async () => {
    const response = await request(kit.app).get('/api/nope').expect(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
