import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApiTestKit, datasetVehicle, type ApiTestKit } from '../testing/api-test-kit.js';

const BID_URL = '/api/vehicles/live-1/bids';
const VALID_BID = { amount: 23_050, expectedCurrentBid: 22_800 };

describe('POST /api/vehicles/:vehicleId/bids', () => {
  let kit: ApiTestKit;
  let buyer: Awaited<ReturnType<ApiTestKit['signedIn']>>;

  beforeEach(async () => {
    kit = createApiTestKit([
      datasetVehicle(),
      datasetVehicle({ id: 'soon-1', lot: 'A-0002' }),
      datasetVehicle({ id: 'buy-now-1', lot: 'A-0003', buy_now_price: 30_000 }),
    ]);
    kit.schedule('soon-1', 'upcoming');
    buyer = await kit.signedIn();
  });

  const bid = (body: object, key: string = crypto.randomUUID(), url = BID_URL) =>
    buyer.post(url).set('Idempotency-Key', key).send(body);

  it('accepts a bid and returns the updated auction state', async () => {
    const response = await bid(VALID_BID).expect(201);
    expect(response.body).toMatchObject({
      status: 'live',
      currentBid: 23_050,
      bidCount: 17,
      minNextBid: 23_300,
      reserveStatus: 'not_met',
      viewer: { isHighBidder: true, hasBid: true, purchased: false },
      version: 1,
    });
    expect(response.body).not.toHaveProperty('reservePrice');
  });

  it('requires sign-in', async () => {
    const response = await request(kit.app)
      .post(BID_URL)
      .set('Idempotency-Key', 'k1')
      .send(VALID_BID)
      .expect(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it('requires an idempotency key', async () => {
    const response = await buyer.post(BID_URL).send(VALID_BID).expect(400);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('accepts only JSON bodies', async () => {
    const response = await buyer
      .post(BID_URL)
      .set('Idempotency-Key', 'k1')
      .type('form')
      .send('amount=23050')
      .expect(415);
    expect(response.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('returns 404 for an unknown vehicle', async () => {
    const response = await bid(VALID_BID, undefined, '/api/vehicles/nope/bids').expect(404);
    expect(response.body.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('returns 422 with field errors for an invalid amount', async () => {
    const response = await bid({ amount: 23_050.5, expectedCurrentBid: 22_800 }).expect(422);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.errors).toEqual([expect.objectContaining({ path: 'amount' })]);
  });

  it('returns 422 for a bid over $1,000,000', async () => {
    const response = await bid({ amount: 1_000_001, expectedCurrentBid: 22_800 }).expect(422);
    expect(response.body.code).toBe('BID_TOO_HIGH');
  });

  it('rejects a stale price with the latest state', async () => {
    kit.rivalBid('live-1', 23_050);
    const response = await bid(VALID_BID).expect(409);
    expect(response.body.code).toBe('PRICE_CHANGED');
    expect(response.body.auction).toMatchObject({ currentBid: 23_050, minNextBid: 23_300 });
  });

  it('rejects a bid below the minimum', async () => {
    const response = await bid({ amount: 22_900, expectedCurrentBid: 22_800 }).expect(409);
    expect(response.body.code).toBe('BID_TOO_LOW');
    expect(response.body.auction.minNextBid).toBe(23_050);
  });

  it('rejects a bid from the current high bidder', async () => {
    await bid(VALID_BID).expect(201);
    const response = await bid({ amount: 23_300, expectedCurrentBid: 23_050 }).expect(409);
    expect(response.body.code).toBe('ALREADY_HIGH_BIDDER');
  });

  it('rejects a bid on an auction that has not opened', async () => {
    const response = await bid(VALID_BID, undefined, '/api/vehicles/soon-1/bids').expect(409);
    expect(response.body.code).toBe('AUCTION_NOT_LIVE');
    expect(response.body.auction.status).toBe('upcoming');
  });

  it('rejects a bid after a Buy Now purchase', async () => {
    await buyer.post('/api/vehicles/buy-now-1/buy-now').set('Idempotency-Key', 'b1').send({});
    const response = await bid(VALID_BID, undefined, '/api/vehicles/buy-now-1/bids').expect(409);
    expect(response.body.code).toBe('AUCTION_NOT_LIVE');
    expect(response.body.auction).toMatchObject({ status: 'ended', outcome: 'sold_buy_now' });
  });

  describe('idempotency', () => {
    it('replays the original result for a repeated key, with no further effect', async () => {
      const first = await bid(VALID_BID, 'same-key').expect(201);
      const replay = await bid(VALID_BID, 'same-key').expect(201);

      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect(replay.body).toEqual(first.body);
      const vehicle = await buyer.get('/api/vehicles/live-1').expect(200);
      expect(vehicle.body.auction.bidCount).toBe(17);
    });

    it('replays a rejection too', async () => {
      const first = await bid({ amount: 100, expectedCurrentBid: 22_800 }, 'low-key').expect(409);
      const replay = await bid({ amount: 100, expectedCurrentBid: 22_800 }, 'low-key').expect(409);
      expect(replay.body).toEqual(first.body);
    });

    it('rejects a key reused with a different body', async () => {
      await bid(VALID_BID, 'reused').expect(201);
      const response = await bid({ amount: 23_300, expectedCurrentBid: 23_050 }, 'reused').expect(
        422,
      );
      expect(response.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });
});
