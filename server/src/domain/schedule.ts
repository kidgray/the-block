const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const SCHEDULE_WINDOW_BEFORE_MS = 4 * HOUR_MS;
export const SCHEDULE_WINDOW_AFTER_MS = 4 * HOUR_MS;
export const AUCTION_DURATION_MS = 3 * HOUR_MS;

export interface AuctionWindow {
  start: number;
  end: number;
}

/**
 * Design §8.4: maps the dataset's start times linearly (order preserved) onto
 * [seedTime − 4h, seedTime + 4h], rounded to the minute, each auction lasting 3 hours.
 */
export function mapSchedule(datasetStarts: readonly number[], seedTime: number): AuctionWindow[] {
  const earliest = Math.min(...datasetStarts);
  const latest = Math.max(...datasetStarts);
  const span = latest - earliest;
  const windowMs = SCHEDULE_WINDOW_BEFORE_MS + SCHEDULE_WINDOW_AFTER_MS;

  return datasetStarts.map((original) => {
    const ratio = span === 0 ? 0.5 : (original - earliest) / span;
    const start =
      Math.round((seedTime - SCHEDULE_WINDOW_BEFORE_MS + ratio * windowMs) / MINUTE_MS) * MINUTE_MS;
    return { start, end: start + AUCTION_DURATION_MS };
  });
}

/** Dataset timestamps carry no zone (`2026-04-05T14:00:00`); they are read as UTC (design §2). */
export function parseDatasetTimestamp(value: string): number {
  const ms = Date.parse(`${value}Z`);
  if (Number.isNaN(ms)) throw new Error(`Invalid dataset timestamp: ${value}`);
  return ms;
}
