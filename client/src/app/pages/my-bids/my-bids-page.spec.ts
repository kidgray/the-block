import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { MyBidsResponse, User } from '@the-block/shared';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { auctionState, vehicleSummary } from '../../../testing/fixtures';
import { BidsApi } from '../../core/api/bids-api';
import { SessionService } from '../../core/session/session.service';
import { ACTIVE_REFRESH_MS, MyBidsPage } from './my-bids-page';

const RESPONSE: MyBidsResponse = {
  active: [
    { vehicle: vehicleSummary({ id: 'a1' }), myHighestBid: 6_000, price: 6_000, status: 'winning' },
    { vehicle: vehicleSummary({ id: 'a2' }), myHighestBid: 6_000, price: 6_500, status: 'outbid' },
  ],
  ended: [
    {
      vehicle: vehicleSummary({ id: 'e1', auction: auctionState({ status: 'ended' }) }),
      myHighestBid: null,
      price: 31_000,
      status: 'purchased',
    },
  ],
};

describe('MyBidsPage', () => {
  let fixture: ComponentFixture<MyBidsPage>;
  let element: HTMLElement;
  let myBids: ReturnType<typeof vi.fn>;
  let user$: BehaviorSubject<User | null>;

  async function render(fetch: ReturnType<typeof vi.fn>): Promise<void> {
    myBids = fetch;
    user$ = new BehaviorSubject<User | null>({ id: 'demo-buyer', displayName: 'Demo Buyer' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BidsApi, useValue: { myBids } },
        { provide: SessionService, useValue: { user$ } },
      ],
    });
    fixture = TestBed.createComponent(MyBidsPage);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const tabs = () => [...element.querySelectorAll<HTMLElement>('[role=tab]')];
  const rowStatuses = () =>
    [...element.querySelectorAll('app-my-bid-row .status')].map((status) =>
      status.textContent?.trim(),
    );

  afterEach(() => vi.useRealTimers());

  it('shows the active auctions first, with a count on each tab', async () => {
    await render(vi.fn(() => of(RESPONSE)));
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(['Active (2)', 'Ended (1)']);
    expect(rowStatuses()).toEqual(['Winning', 'Outbid']);
  });

  it('shows the ended auctions on the Ended tab', async () => {
    await render(vi.fn(() => of(RESPONSE)));
    tabs()[1]!.click();
    await fixture.whenStable();
    expect(rowStatuses()).toEqual(['Purchased']);
  });

  it('points to live auctions when the buyer is not bidding on any', async () => {
    await render(vi.fn(() => of({ active: [], ended: [] })));
    expect(element.querySelector('.empty')?.textContent).toContain(
      "You're not bidding on any live auctions.",
    );
    expect(element.querySelector('.empty a')?.getAttribute('href')).toBe('/vehicles');
  });

  it('shows an error with Retry, and Retry loads again', async () => {
    await render(
      vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('offline')))
        .mockReturnValue(of(RESPONSE)),
    );
    expect(element.querySelector('[role=alert]')?.textContent).toContain(
      "Couldn't load your bids.",
    );

    element.querySelector<HTMLButtonElement>('[role=alert] button')!.click();
    await fixture.whenStable();
    expect(rowStatuses()).toEqual(['Winning', 'Outbid']);
  });

  it('refreshes every 30 seconds on the Active tab, keeping its rows if a refresh fails', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await render(
      vi
        .fn()
        .mockReturnValueOnce(of(RESPONSE))
        .mockReturnValueOnce(throwError(() => new Error('blip')))
        .mockReturnValue(of(RESPONSE)),
    );
    expect(myBids).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ACTIVE_REFRESH_MS);
    await fixture.whenStable();
    expect(myBids).toHaveBeenCalledTimes(2);
    expect(rowStatuses()).toEqual(['Winning', 'Outbid']);

    tabs()[1]!.click();
    await fixture.whenStable();
    vi.advanceTimersByTime(3 * ACTIVE_REFRESH_MS);
    expect(myBids).toHaveBeenCalledTimes(2);
  });

  it('returns to the inventory when the buyer signs out', async () => {
    await render(vi.fn(() => of(RESPONSE)));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    user$.next(null);
    expect(navigate).toHaveBeenCalledWith(['/vehicles']);
  });
});
