import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { AuctionClock } from '../clock.js';
import { openDatabase } from '../db/connection.js';
import { resetDatabase } from '../db/seed.js';
import { datasetVehicle, NOW } from '../testing/api-test-kit.js';

describe('serving the client build', () => {
  let clientDir: string;
  let app: ReturnType<typeof createApp>['app'];

  beforeAll(() => {
    clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-block-client-'));
    fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html><title>The Block</title>');
    fs.writeFileSync(path.join(clientDir, 'main-ABC123.js'), 'console.log(1);');
    const db = openDatabase(':memory:');
    resetDatabase(db, [datasetVehicle()], NOW);
    app = createApp({
      db,
      clock: new AuctionClock(() => NOW),
      logger: pino({ level: 'silent' }),
      clientDir,
    }).app;
  });

  afterAll(() => fs.rmSync(clientDir, { recursive: true, force: true }));

  it('serves hashed bundles with a long cache lifetime', async () => {
    const response = await request(app).get('/main-ABC123.js').expect(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('answers deep links with index.html, never cached', async () => {
    for (const url of ['/', '/vehicles/live-1', '/my-bids']) {
      const response = await request(app).get(url).expect(200);
      expect(response.text, url).toContain('<title>The Block</title>');
      expect(response.headers['cache-control']).toBe('no-cache');
    }
  });

  it('still answers unknown API paths with a JSON 404', async () => {
    const response = await request(app).get('/api/nope').expect(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('allows vehicle photos from other HTTPS hosts and does not upgrade HTTP requests', async () => {
    const response = await request(app).get('/').expect(200);
    const policy = response.headers['content-security-policy'] as string;
    expect(policy).toContain("img-src 'self' data: https:");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });
});
