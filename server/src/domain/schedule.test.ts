import { describe, expect, it } from 'vitest';
import {
  AUCTION_DURATION_MS,
  mapSchedule,
  parseDatasetTimestamp,
  SCHEDULE_WINDOW_AFTER_MS,
  SCHEDULE_WINDOW_BEFORE_MS,
} from './schedule.js';

const SEED = Date.parse('2026-10-31T12:00:00Z');

describe('mapSchedule', () => {
  const starts = [
    parseDatasetTimestamp('2026-03-31T09:00:00'),
    parseDatasetTimestamp('2026-04-02T15:30:00'),
    parseDatasetTimestamp('2026-04-06T20:00:00'),
  ];

  it('maps the earliest start to seed − 4h and the latest to seed + 4h', () => {
    const windows = mapSchedule(starts, SEED);
    expect(windows[0]?.start).toBe(SEED - SCHEDULE_WINDOW_BEFORE_MS);
    expect(windows[2]?.start).toBe(SEED + SCHEDULE_WINDOW_AFTER_MS);
  });

  it('preserves the original order', () => {
    const shuffled = [starts[2]!, starts[0]!, starts[1]!];
    const windows = mapSchedule(shuffled, SEED);
    expect(windows[1]!.start).toBeLessThan(windows[2]!.start);
    expect(windows[2]!.start).toBeLessThan(windows[0]!.start);
  });

  it('gives every auction a 3-hour duration', () => {
    for (const window of mapSchedule(starts, SEED)) {
      expect(window.end - window.start).toBe(AUCTION_DURATION_MS);
    }
  });

  it('rounds start times to the minute', () => {
    for (const window of mapSchedule(starts, SEED + 12_345)) {
      expect(window.start % 60_000).toBe(0);
    }
  });

  it('centres a single start time on the seed time', () => {
    expect(mapSchedule([starts[0]!], SEED)[0]?.start).toBe(SEED);
  });
});

describe('parseDatasetTimestamp', () => {
  it('reads zone-less timestamps as UTC', () => {
    expect(parseDatasetTimestamp('2026-04-05T14:00:00')).toBe(Date.parse('2026-04-05T14:00:00Z'));
  });

  it('rejects malformed timestamps', () => {
    expect(() => parseDatasetTimestamp('not a date')).toThrow();
  });
});
