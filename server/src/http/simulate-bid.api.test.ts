import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApiTestKit, datasetVehicle } from '../testing/api-test-kit.js';

const SIMULATE_URL = '/api/dev/vehicles/live-1/simulate-bid';

describe('POST /api/dev/vehicles/:vehicleId/simulate-bid', () => {
  it('does not exist unless dev endpoints are enabled', async () => {
    const kit = createApiTestKit([datasetVehicle()]);
    const response = await request(kit.app).post(SIMULATE_URL).send({}).expect(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('places an immediate counter-bid as "Another bidder"', async () => {
    const kit = createApiTestKit([datasetVehicle()], { enableDevEndpoints: true });
    const buyer = await kit.signedIn();
    await buyer
      .post('/api/vehicles/live-1/bids')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ amount: 23_050, expectedCurrentBid: 22_800 })
      .expect(201);

    await request(kit.app).post(SIMULATE_URL).send({}).expect(201);

    const detail = await buyer.get('/api/vehicles/live-1').expect(200);
    expect(detail.body.auction).toMatchObject({
      currentBid: 23_300,
      bidCount: 18,
      viewer: { isHighBidder: false, hasBid: true },
    });
  });

  it('follows the usual bid rules', async () => {
    const kit = createApiTestKit([datasetVehicle()], { enableDevEndpoints: true });
    kit.schedule('live-1', 'ended');
    const response = await request(kit.app).post(SIMULATE_URL).send({}).expect(409);
    expect(response.body.code).toBe('AUCTION_NOT_LIVE');
    await request(kit.app).post('/api/dev/vehicles/missing/simulate-bid').send({}).expect(404);
  });
});
