import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MyBidRow as MyBidRowData } from '@the-block/shared';
import { auctionState, vehicleSummary } from '../../../testing/fixtures';
import { MY_BID_STATUS_VIEW, MyBidRow } from './my-bid-row';

describe('MyBidRow', () => {
  let element: HTMLElement;

  async function render(row: MyBidRowData): Promise<void> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(MyBidRow);
    fixture.componentRef.setInput('row', row);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const text = (selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const labels = () => [...element.querySelectorAll('dt')].map((term) => term.textContent?.trim());

  it('shows a live auction with the buyer’s bid, current price, and time left', async () => {
    await render({
      vehicle: vehicleSummary({ auction: auctionState({ currentBid: 7_000, bidCount: 3 }) }),
      myHighestBid: 6_500,
      price: 7_000,
      status: 'outbid',
    });

    expect(element.querySelector('a.row')?.getAttribute('href')).toBe('/vehicles/v1');
    expect(text('.title')).toBe('2018 Honda Pilot');
    expect(text('.lot')).toBe('Lot A-0001');
    expect(text('.status')).toBe('Outbid');
    expect(element.querySelector('.status')?.classList).toContain('error');
    expect(text('.my-bid')).toBe('$6,500');
    expect(text('.price')).toBe('$7,000');
    expect(labels()).toEqual(['Your highest bid', 'Current price', 'Time left']);
    expect(element.querySelector('app-countdown')).toBeTruthy();
  });

  it('shows an ended purchase with no bid and the final price', async () => {
    await render({
      vehicle: vehicleSummary({ auction: auctionState({ status: 'ended' }) }),
      myHighestBid: null,
      price: 31_000,
      status: 'purchased',
    });

    expect(text('.status')).toBe('Purchased');
    expect(text('.my-bid')).toBe('—');
    expect(text('.price')).toBe('$31,000');
    expect(labels()).toEqual(['Your highest bid', 'Final price', 'Ended']);
    expect(element.querySelector('app-countdown')).toBeNull();
  });

  it('names every status', () => {
    expect(Object.values(MY_BID_STATUS_VIEW).map((view) => view.label)).toEqual([
      'Winning',
      'Outbid',
      'Won',
      'Lost',
      'Reserve not met',
      'Purchased',
    ]);
  });
});
