import type { AuctionState } from '@the-block/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createApiTestKit,
  datasetVehicle,
  HOUR_MS,
  NOW,
  type ApiTestKit,
} from '../testing/api-test-kit.js';
import { listen, openEventStream, type EventStreamClient } from '../testing/event-stream.js';

const EVENTS_PATH = '/api/vehicles/live-1/events';

describe('GET /api/vehicles/:vehicleId/events (SSE)', () => {
  let kit: ApiTestKit;
  let server: Awaited<ReturnType<typeof listen>>;
  let streams: EventStreamClient[];

  beforeEach(async () => {
    kit = createApiTestKit([datasetVehicle(), datasetVehicle({ id: 'other-1', lot: 'A-0002' })], {
      keepAliveMs: 100,
    });
    server = await listen(kit.app);
    streams = [];
  });

  afterEach(async () => {
    for (const stream of streams) stream.close();
    await server.close();
  });

  const open = async (path = EVENTS_PATH, cookie?: string) => {
    const stream = await openEventStream(`${server.baseUrl}${path}`, cookie);
    streams.push(stream);
    return stream;
  };

  /** The next auction snapshot, skipping keep-alive comments. */
  const nextState = async (stream: EventStreamClient): Promise<AuctionState> => {
    for (;;) {
      const message = await stream.next();
      if (message.event === 'auction') return JSON.parse(message.data) as AuctionState;
    }
  };

  /** Signs in over HTTP; returns the session cookie and a function that bids as that buyer. */
  const signIn = async () => {
    const response = await request(kit.app).post('/api/session').send({}).expect(201);
    const cookie = String(response.headers['set-cookie']).split(';')[0]!;
    const bid = (amount: number, expectedCurrentBid: number | null, vehicleId = 'live-1') =>
      request(kit.app)
        .post(`/api/vehicles/${vehicleId}/bids`)
        .set('Cookie', cookie)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount, expectedCurrentBid })
        .expect(201);
    return { cookie, bid };
  };

  it('opens an event stream and sends the current state first', async () => {
    const stream = await open();
    expect(stream.status).toBe(200);
    expect(stream.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(stream.headers.get('cache-control')).toContain('no-cache');

    const state = await nextState(stream);
    expect(state).toMatchObject({ status: 'live', currentBid: 22_800, version: 0, viewer: null });
    expect(state).not.toHaveProperty('reservePrice');
  });

  it('pushes a new snapshot to every viewer when a bid is accepted', async () => {
    const buyer = await signIn();
    const signedOut = await open();
    const signedIn = await open(EVENTS_PATH, buyer.cookie);
    await nextState(signedOut);
    await nextState(signedIn);

    await buyer.bid(23_050, 22_800);

    // Each payload is built for its own viewer (design §6.1).
    expect(await nextState(signedIn)).toMatchObject({
      currentBid: 23_050,
      bidCount: 17,
      minNextBid: 23_300,
      version: 1,
      viewer: { isHighBidder: true, hasBid: true },
    });
    expect(await nextState(signedOut)).toMatchObject({ currentBid: 23_050, viewer: null });
  });

  it('tells the buyer they were outbid when a rival bid lands', async () => {
    const buyer = await signIn();
    await buyer.bid(23_050, 22_800);
    const stream = await open(EVENTS_PATH, buyer.cookie);
    expect((await nextState(stream)).viewer?.isHighBidder).toBe(true);

    kit.rivalBid('live-1', 23_300);
    kit.theBlock.events.publish({
      type: 'bid_accepted',
      vehicleId: 'live-1',
      bidderId: 'sim-bidder-1',
      amount: 23_300,
    });

    expect(await nextState(stream)).toMatchObject({
      currentBid: 23_300,
      minNextBid: 23_550,
      viewer: { isHighBidder: false, hasBid: true },
    });
  });

  it('only forwards events for its own vehicle', async () => {
    const buyer = await signIn();
    const stream = await open();
    await nextState(stream);

    await buyer.bid(23_050, 22_800, 'other-1');
    const message = await stream.next();
    expect(message.event).toBe(':'); // only the keep-alive arrives
  });

  it('sends status changes, such as the auction ending', async () => {
    const stream = await open();
    await nextState(stream);

    kit.setNow(NOW + 3 * HOUR_MS);
    kit.theBlock.events.publish({ type: 'status_changed', vehicleId: 'live-1', status: 'ended' });

    expect(await nextState(stream)).toMatchObject({
      status: 'ended',
      minNextBid: null,
      outcome: 'reserve_not_met',
    });
  });

  it('writes keep-alive comments while idle', async () => {
    const stream = await open();
    await nextState(stream);
    expect(await stream.next()).toEqual({ event: ':', data: 'keep-alive' });
  });

  it('stops listening when the client disconnects', async () => {
    const listenersBefore = kit.theBlock.events.listenerCount;
    const stream = await open();
    await nextState(stream);
    expect(kit.theBlock.events.listenerCount).toBe(listenersBefore + 1);

    stream.close();
    await expect.poll(() => kit.theBlock.events.listenerCount).toBe(listenersBefore);
  });

  it('answers an unknown vehicle with a 404 problem, not a stream', async () => {
    const response = await request(kit.app).get('/api/vehicles/missing/events').expect(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body.code).toBe('VEHICLE_NOT_FOUND');
  });
});
