import { countdownLabel, formatDuration, isEndingSoon } from './countdown';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const MINUTE = 60_000;

describe('formatDuration', () => {
  it('shows hours and minutes from 10 minutes up', () => {
    expect(formatDuration(2 * 60 * MINUTE + 14 * MINUTE + 30_000)).toBe('2h 14m');
    expect(formatDuration(45 * MINUTE)).toBe('45m');
    expect(formatDuration(10 * MINUTE)).toBe('10m');
  });

  it('adds seconds in the final 10 minutes', () => {
    expect(formatDuration(9 * MINUTE + 5_000)).toBe('9m 05s');
    expect(formatDuration(42_000)).toBe('42s');
  });
});

describe('countdownLabel', () => {
  it('counts down to the start of an upcoming auction', () => {
    expect(
      countdownLabel(
        { status: 'upcoming', auctionStart: at(80 * MINUTE), auctionEnd: at(260 * MINUTE) },
        NOW,
      ),
    ).toBe('Starts in 1h 20m');
  });

  it('counts down to the end of a live auction', () => {
    expect(
      countdownLabel({ status: 'live', auctionStart: at(-MINUTE), auctionEnd: at(30_000) }, NOW),
    ).toBe('Ends in 30s');
  });

  it('shows a transitional label once the boundary passes, until the server confirms', () => {
    expect(
      countdownLabel({ status: 'live', auctionStart: at(-MINUTE), auctionEnd: at(-1) }, NOW),
    ).toBe('Ending…');
  });

  it('says Ended for ended auctions', () => {
    expect(countdownLabel({ status: 'ended', auctionStart: at(-2), auctionEnd: at(-1) }, NOW)).toBe(
      'Ended',
    );
  });
});

describe('isEndingSoon', () => {
  it('is true only for live auctions in their final 10 minutes', () => {
    expect(
      isEndingSoon({ status: 'live', auctionStart: at(-MINUTE), auctionEnd: at(9 * MINUTE) }, NOW),
    ).toBe(true);
    expect(
      isEndingSoon({ status: 'live', auctionStart: at(-MINUTE), auctionEnd: at(11 * MINUTE) }, NOW),
    ).toBe(false);
    expect(
      isEndingSoon(
        { status: 'upcoming', auctionStart: at(MINUTE), auctionEnd: at(5 * MINUTE) },
        NOW,
      ),
    ).toBe(false);
  });
});
