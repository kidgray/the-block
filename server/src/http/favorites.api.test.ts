import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createApiTestKit,
  datasetVehicle,
  HOUR_MS,
  NOW,
  type ApiTestKit,
} from '../testing/api-test-kit.js';

describe('favorites API', () => {
  let kit: ApiTestKit;
  let buyer: Awaited<ReturnType<ApiTestKit['signedIn']>>;

  beforeEach(async () => {
    kit = createApiTestKit([
      datasetVehicle({ id: 'ends-later', lot: 'A-0001' }),
      datasetVehicle({ id: 'ends-first', lot: 'A-0002' }),
      datasetVehicle({ id: 'ended', lot: 'A-0003' }),
    ]);
    kit.setAuctionWindow('ends-later', NOW - HOUR_MS, NOW + 2 * HOUR_MS);
    kit.setAuctionWindow('ends-first', NOW - HOUR_MS, NOW + HOUR_MS);
    kit.schedule('ended', 'ended');
    buyer = await kit.signedIn();
  });

  const favoriteIds = async () =>
    ((await buyer.get('/api/me/favorites').expect(200)).body as { id: string }[]).map((v) => v.id);

  it('requires sign-in', async () => {
    const anonymous = request(kit.app);
    expect((await anonymous.get('/api/me/favorites').expect(401)).body.code).toBe('AUTH_REQUIRED');
    await anonymous.put('/api/me/favorites/ended').send({}).expect(401);
    await anonymous.delete('/api/me/favorites/ended').expect(401);
  });

  it('adds and removes favorites, idempotently', async () => {
    await buyer.put('/api/me/favorites/ends-later').send({}).expect(204);
    await buyer.put('/api/me/favorites/ends-later').send({}).expect(204);
    expect(await favoriteIds()).toEqual(['ends-later']);

    await buyer.delete('/api/me/favorites/ends-later').expect(204);
    await buyer.delete('/api/me/favorites/ends-later').expect(204);
    expect(await favoriteIds()).toEqual([]);
  });

  it('lists favorites as vehicle cards, ending soonest first and ended last', async () => {
    for (const id of ['ended', 'ends-later', 'ends-first']) {
      await buyer.put(`/api/me/favorites/${id}`).send({}).expect(204);
    }
    const response = await buyer.get('/api/me/favorites').expect(200);
    expect(response.body.map((v: { id: string }) => v.id)).toEqual([
      'ends-first',
      'ends-later',
      'ended',
    ]);
    expect(response.body[0]).toMatchObject({ isFavorite: true, auction: { status: 'live' } });
    expect(response.body[2].auction.status).toBe('ended');
  });

  it('marks favorites on the inventory and the detail page, only for the signed-in buyer', async () => {
    await buyer.put('/api/me/favorites/ends-first').send({}).expect(204);

    const list = await buyer.get('/api/vehicles').expect(200);
    const flags = Object.fromEntries(
      list.body.items.map((v: { id: string; isFavorite: boolean }) => [v.id, v.isFavorite]),
    );
    expect(flags).toEqual({ 'ends-first': true, 'ends-later': false });
    expect((await buyer.get('/api/vehicles/ends-first').expect(200)).body.isFavorite).toBe(true);

    const anonymous = await request(kit.app).get('/api/vehicles/ends-first').expect(200);
    expect(anonymous.body).not.toHaveProperty('isFavorite');
  });

  it('answers an unknown vehicle with 404', async () => {
    const response = await buyer.put('/api/me/favorites/missing').send({}).expect(404);
    expect(response.body.code).toBe('VEHICLE_NOT_FOUND');
    await buyer.delete('/api/me/favorites/missing').expect(404);
  });

  it('accepts only JSON when adding, like every write', async () => {
    await buyer.put('/api/me/favorites/ended').type('text/plain').send('x').expect(415);
  });
});
