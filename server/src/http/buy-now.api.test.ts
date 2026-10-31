import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApiTestKit, datasetVehicle, NOW, type ApiTestKit } from '../testing/api-test-kit.js';

const BUY_URL = '/api/vehicles/buy-now-1/buy-now';

describe('POST /api/vehicles/:vehicleId/buy-now', () => {
  let kit: ApiTestKit;
  let buyer: Awaited<ReturnType<ApiTestKit['signedIn']>>;

  beforeEach(async () => {
    kit = createApiTestKit([
      datasetVehicle({ id: 'buy-now-1', buy_now_price: 30_000 }),
      datasetVehicle({ id: 'no-buy-now', lot: 'A-0002', buy_now_price: null }),
      datasetVehicle({ id: 'soon-1', lot: 'A-0003', buy_now_price: 30_000 }),
    ]);
    kit.schedule('soon-1', 'upcoming');
    buyer = await kit.signedIn();
  });

  const buyNow = (url = BUY_URL, key: string = crypto.randomUUID(), body: object = {}) =>
    buyer.post(url).set('Idempotency-Key', key).send(body);

  it('ends the auction as a sale to the buyer', async () => {
    const response = await buyNow().expect(201);
    expect(response.body).toMatchObject({
      status: 'ended',
      outcome: 'sold_buy_now',
      buyNowAvailable: false,
      minNextBid: null,
      auctionEnd: new Date(NOW).toISOString(),
      viewer: { purchased: true, isHighBidder: false, hasBid: false },
      version: 1,
    });
  });

  it('requires sign-in and an idempotency key', async () => {
    await request(kit.app).post(BUY_URL).set('Idempotency-Key', 'k').send({}).expect(401);
    const response = await buyer.post(BUY_URL).send({}).expect(400);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('takes an empty JSON body', async () => {
    const response = await buyNow(BUY_URL, undefined, { price: 1 }).expect(422);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 404 for an unknown vehicle', async () => {
    const response = await buyNow('/api/vehicles/nope/buy-now').expect(404);
    expect(response.body.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('rejects a vehicle with no Buy Now price', async () => {
    const response = await buyNow('/api/vehicles/no-buy-now/buy-now').expect(409);
    expect(response.body.code).toBe('BUY_NOW_UNAVAILABLE');
    expect(response.body.auction.buyNowPrice).toBeNull();
  });

  it('rejects once bidding has reached the Buy Now price', async () => {
    kit.rivalBid('buy-now-1', 30_000);
    const response = await buyNow().expect(409);
    expect(response.body.code).toBe('BUY_NOW_UNAVAILABLE');
    expect(response.body.auction).toMatchObject({ currentBid: 30_000, buyNowAvailable: false });
  });

  it('rejects an auction that has not opened', async () => {
    const response = await buyNow('/api/vehicles/soon-1/buy-now').expect(409);
    expect(response.body.code).toBe('AUCTION_NOT_LIVE');
  });

  it('rejects a second purchase of the same vehicle', async () => {
    await buyNow().expect(201);
    const response = await buyNow().expect(409);
    expect(response.body.code).toBe('AUCTION_NOT_LIVE');
  });

  it('replays the original purchase for a repeated key', async () => {
    const first = await buyNow(BUY_URL, 'same-key').expect(201);
    const replay = await buyNow(BUY_URL, 'same-key').expect(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body).toEqual(first.body);
  });

  it('rejects a key already used for a bid', async () => {
    await buyer
      .post('/api/vehicles/buy-now-1/bids')
      .set('Idempotency-Key', 'shared-key')
      .send({ amount: 23_050, expectedCurrentBid: 22_800 })
      .expect(201);
    const response = await buyNow(BUY_URL, 'shared-key').expect(422);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});
