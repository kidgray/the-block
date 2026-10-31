import { TestBed } from '@angular/core/testing';
import { StatusChip, statusChip } from './status-chip';

describe('statusChip', () => {
  it('labels live and upcoming auctions by their status', () => {
    expect(statusChip({ status: 'live', outcome: null })).toEqual({ label: 'Live', tone: 'live' });
    expect(statusChip({ status: 'upcoming', outcome: null })).toEqual({
      label: 'Upcoming',
      tone: 'upcoming',
    });
  });

  it('labels ended auctions by their outcome', () => {
    expect(statusChip({ status: 'ended', outcome: 'sold' }).label).toBe('Sold');
    expect(statusChip({ status: 'ended', outcome: 'sold_buy_now' }).label).toBe('Sold');
    expect(statusChip({ status: 'ended', outcome: 'reserve_not_met' }).label).toBe(
      'Reserve not met',
    );
    expect(statusChip({ status: 'ended', outcome: 'no_sale' }).label).toBe('No sale');
    expect(statusChip({ status: 'ended', outcome: null }).label).toBe('Ended');
  });
});

describe('StatusChip', () => {
  it('renders the label with its tone', async () => {
    const fixture = TestBed.createComponent(StatusChip);
    fixture.componentRef.setInput('auction', { status: 'ended', outcome: 'reserve_not_met' });
    await fixture.whenStable();

    const chip = (fixture.nativeElement as HTMLElement).querySelector('.chip')!;
    expect(chip.textContent?.trim()).toBe('Reserve not met');
    expect(chip.classList).toContain('closed');
  });
});
