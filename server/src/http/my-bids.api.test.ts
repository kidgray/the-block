import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createApiTestKit,
  datasetVehicle,
  HOUR_MS,
  NOW,
  type ApiTestKit,
} from '../testing/api-test-kit.js';

describe('GET /api/me/bids', () => {
  let kit: ApiTestKit;
  let buyer: Awaited<ReturnType<ApiTestKit['signedIn']>>;

  const vehicle = (id: string, lot: string, overrides = {}) =>
    datasetVehicle({ id, lot, current_bid: 22_800, bid_count: 16, ...overrides });

  const bid = (vehicleId: string, amount: number, expectedCurrentBid: number) =>
    buyer
      .post(`/api/vehicles/${vehicleId}/bids`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ amount, expectedCurrentBid })
      .expect(201);

  beforeEach(async () => {
    kit = createApiTestKit([
      vehicle('winning', 'A-1'),
      vehicle('outbid', 'A-2'),
      vehicle('won', 'A-3', { reserve_price: 20_000 }),
      vehicle('reserve', 'A-4', { reserve_price: 90_000 }),
      vehicle('bought', 'A-5', { buy_now_price: 40_000 }),
      vehicle('untouched', 'A-6'),
    ]);
    buyer = await kit.signedIn();
  });

  it('requires sign-in', async () => {
    const response = await request(kit.app).get('/api/me/bids').expect(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
  });

  it('is empty before the buyer has bid', async () => {
    const response = await buyer.get('/api/me/bids').expect(200);
    expect(response.body).toEqual({ active: [], ended: [] });
  });

  it('sorts every auction the buyer took part in into Active and Ended', async () => {
    for (const id of ['winning', 'outbid', 'won', 'reserve']) await bid(id, 23_050, 22_800);
    kit.rivalBid('outbid', 23_300);
    await buyer
      .post('/api/vehicles/bought/buy-now')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({})
      .expect(201);

    // Four hours later: "bought" ended at the purchase, "won" 2 hours ago, "reserve" 1 hour ago;
    // "outbid" ends in 2 hours and "winning" in 3.
    kit.setNow(NOW + 4 * HOUR_MS);
    kit.setAuctionWindow('won', NOW - HOUR_MS, NOW + 2 * HOUR_MS);
    kit.setAuctionWindow('reserve', NOW, NOW + 3 * HOUR_MS);
    kit.setAuctionWindow('outbid', NOW + 3 * HOUR_MS, NOW + 6 * HOUR_MS);
    kit.setAuctionWindow('winning', NOW + 3 * HOUR_MS, NOW + 7 * HOUR_MS);

    const { body } = await buyer.get('/api/me/bids').expect(200);
    const summarize = (rows: { vehicle: { id: string }; status: string }[]) =>
      rows.map((row) => [row.vehicle.id, row.status]);

    expect(summarize(body.active)).toEqual([
      ['outbid', 'outbid'],
      ['winning', 'winning'],
    ]);
    expect(summarize(body.ended)).toEqual([
      ['reserve', 'reserve_not_met'],
      ['won', 'won'],
      ['bought', 'purchased'],
    ]);
  });

  it('reports the buyer’s highest bid and the current or final price', async () => {
    await bid('outbid', 23_050, 22_800);
    kit.rivalBid('outbid', 23_300);
    await buyer
      .post('/api/vehicles/bought/buy-now')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({})
      .expect(201);

    const { body } = await buyer.get('/api/me/bids').expect(200);
    expect(body.active[0]).toMatchObject({ myHighestBid: 23_050, price: 23_300 });
    expect(body.ended[0]).toMatchObject({
      myHighestBid: null,
      price: 40_000,
      status: 'purchased',
      vehicle: { id: 'bought', auction: { viewer: { purchased: true } } },
    });
  });
});
