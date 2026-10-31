import { describe, expect, it } from 'vitest';
import { loadConfig, parseRange } from './config.js';

describe('loadConfig', () => {
  it('turns the simulated bidder and dev endpoints on outside production', () => {
    const config = loadConfig({});
    expect(config.simulatedBidder).toEqual({
      enabled: true,
      seed: 'the-block',
      delayMs: { min: 3_000, max: 10_000 },
    });
    expect(config.enableDevEndpoints).toBe(true);
  });

  it('keeps the simulator but drops dev endpoints in production', () => {
    const config = loadConfig({ NODE_ENV: 'production' });
    expect(config.simulatedBidder.enabled).toBe(true);
    expect(config.enableDevEndpoints).toBe(false);
  });

  it('reads the overrides', () => {
    const config = loadConfig({
      SIM_BIDDER_ENABLED: 'false',
      SIM_BIDDER_SEED: 'walkthrough',
      SIM_BIDDER_DELAY_MS: '500-1500',
      ENABLE_DEV_ENDPOINTS: 'true',
      NODE_ENV: 'production',
    });
    expect(config.simulatedBidder).toEqual({
      enabled: false,
      seed: 'walkthrough',
      delayMs: { min: 500, max: 1_500 },
    });
    expect(config.enableDevEndpoints).toBe(true);
  });
});

describe('parseRange', () => {
  it('reads a range or a single value', () => {
    expect(parseRange('3000-10000', 'X')).toEqual({ min: 3_000, max: 10_000 });
    expect(parseRange(' 250 ', 'X')).toEqual({ min: 250, max: 250 });
  });

  it('rejects malformed or inverted ranges', () => {
    expect(() => parseRange('fast', 'X')).toThrow(/X must look like/);
    expect(() => parseRange('10-5', 'X')).toThrow(/maximum below its minimum/);
  });
});
