import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import type { AuctionState } from '@the-block/shared';
import { BehaviorSubject, type Observable, of, throwError } from 'rxjs';
import { auctionState } from '../../../testing/fixtures';
import { BidsApi } from '../../core/api/bids-api';
import { ApiProblem } from '../../core/http/api-problem';
import { SessionService } from '../../core/session/session.service';
import { SignInService } from '../../core/session/sign-in.service';
import { AuctionStateService } from '../../services/auction-state.service';
import { BidConfirmDialog } from '../bid-confirm-dialog/bid-confirm-dialog';
import { BuyNowConfirmDialog } from '../buy-now-confirm-dialog/buy-now-confirm-dialog';
import { BidPanel } from './bid-panel';

describe('BidPanel custom amount', () => {
  let fixture: ComponentFixture<BidPanel>;
  let element: HTMLElement;
  let ensureSignedIn: ReturnType<typeof vi.fn>;
  let openDialog: ReturnType<typeof vi.fn>;

  async function setUp(signedIn: boolean): Promise<void> {
    const state = auctionState();
    ensureSignedIn = vi.fn(() => of(signedIn));
    openDialog = vi.fn(() => ({ afterClosed: () => of(false) }));

    await TestBed.configureTestingModule({
      imports: [BidPanel],
      providers: [
        {
          provide: AuctionStateService,
          useValue: { state$: of(state), snapshot: state, reload: () => of(state), apply: vi.fn() },
        },
        { provide: SessionService, useValue: { currentUser: signedIn ? { id: 'u1' } : null } },
        { provide: SignInService, useValue: { ensureSignedIn } },
        { provide: BidsApi, useValue: { placeBid: vi.fn() } },
        { provide: MatDialog, useValue: { open: openDialog } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BidPanel);
    fixture.componentRef.setInput('vehicleId', 'v1');
    fixture.componentRef.setInput('vehicleTitle', '2018 Honda Pilot');
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  async function enterAmount(value: string): Promise<void> {
    const input = element.querySelector<HTMLInputElement>('form.custom input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function placeBidButton(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('button.custom-button')!;
  }

  async function clickPlaceBid(): Promise<void> {
    placeBidButton().click();
    await fixture.whenStable();
  }

  it('keeps Place bid disabled until the amount is valid', async () => {
    await setUp(true);
    expect(placeBidButton().disabled).toBe(true); // empty

    for (const invalid of ['10', '6000.5', '2000000']) {
      await enterAmount(invalid);
      expect(placeBidButton().disabled, invalid).toBe(true);
    }

    await enterAmount('6000');
    expect(placeBidButton().disabled).toBe(false);
  });

  it('shows why the amount is invalid while the buyer types', async () => {
    await setUp(true);
    await enterAmount('10');
    expect(element.querySelector('mat-error')?.textContent).toContain('The minimum bid is');
  });

  it('asks a signed-out buyer to sign in, like the Bid button', async () => {
    await setUp(false);
    await enterAmount('6000');
    await clickPlaceBid();
    expect(ensureSignedIn).toHaveBeenCalledTimes(1);
  });

  it('opens the confirmation with the exact amount for a signed-in buyer', async () => {
    await setUp(true);
    await enterAmount('6000');
    await clickPlaceBid();
    expect(openDialog).toHaveBeenCalledWith(
      BidConfirmDialog,
      expect.objectContaining({ data: { vehicleTitle: '2018 Honda Pilot', amount: 6000 } }),
    );
  });
});

describe('BidPanel Buy Now and server responses', () => {
  let fixture: ComponentFixture<BidPanel>;
  let element: HTMLElement;
  let openDialog: ReturnType<typeof vi.fn>;
  let placeBid: ReturnType<typeof vi.fn>;
  let buyNow: ReturnType<typeof vi.fn>;

  const OFFERED = auctionState({ buyNowPrice: 31_000, buyNowAvailable: true });
  const PURCHASED = auctionState({
    status: 'ended',
    outcome: 'sold_buy_now',
    buyNowPrice: 31_000,
    minNextBid: null,
    viewer: { isHighBidder: false, hasBid: false, purchased: true },
    version: 1,
  });

  /** Signed in; the confirmation dialog answers `confirmed`. */
  async function setUp(
    state: AuctionState,
    responses: { placeBid?: Observable<AuctionState>; buyNow?: Observable<AuctionState> } = {},
  ): Promise<void> {
    const auction = new BehaviorSubject(state);
    openDialog = vi.fn(() => ({ afterClosed: () => of(true) }));
    placeBid = vi.fn(() => responses.placeBid ?? of(state));
    buyNow = vi.fn(() => responses.buyNow ?? of(state));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuctionStateService,
          useValue: {
            state$: auction,
            get snapshot() {
              return auction.value;
            },
            reload: () => of(auction.value),
            apply: (next: AuctionState) => auction.next(next),
          },
        },
        { provide: SessionService, useValue: { currentUser: { id: 'demo-buyer' } } },
        { provide: SignInService, useValue: { ensureSignedIn: () => of(true) } },
        { provide: BidsApi, useValue: { placeBid, buyNow } },
        { provide: MatDialog, useValue: { open: openDialog } },
      ],
    });
    fixture = TestBed.createComponent(BidPanel);
    fixture.componentRef.setInput('vehicleId', 'v1');
    fixture.componentRef.setInput('vehicleTitle', '2018 Honda Pilot');
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const text = (selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const buyNowButton = () => element.querySelector<HTMLButtonElement>('button.buy-now-button');

  it('offers Buy Now only while it is available', async () => {
    await setUp(OFFERED);
    expect(buyNowButton()?.textContent?.trim()).toBe('Buy now for $31,000');

    TestBed.resetTestingModule();
    await setUp(auctionState({ buyNowPrice: 31_000, buyNowAvailable: false }));
    expect(buyNowButton()).toBeNull();
  });

  it('confirms the Buy Now price, then shows the purchase', async () => {
    await setUp(OFFERED, { buyNow: of(PURCHASED) });
    buyNowButton()!.click();
    await fixture.whenStable();

    expect(openDialog).toHaveBeenCalledWith(
      BuyNowConfirmDialog,
      expect.objectContaining({ data: { vehicleTitle: '2018 Honda Pilot', price: 31_000 } }),
    );
    expect(buyNow).toHaveBeenCalledWith('v1', expect.any(String));
    expect(text('.outcome')).toBe('You bought this vehicle for $31,000');
    expect(text('.price-fact dt')).toBe('Sold through Buy Now');
    expect(text('.price-fact dd')).toBe('$31,000');
    expect(element.textContent).not.toContain('Reserve');
    expect(text('.message')).toBe('Purchase confirmed: the 2018 Honda Pilot is yours.');
    expect(element.querySelector('.bid-button')).toBeNull();
  });

  it('shows the server’s reason and latest state when Buy Now is refused', async () => {
    const withdrawn = auctionState({
      buyNowPrice: 31_000,
      buyNowAvailable: false,
      currentBid: 31_000,
      bidCount: 1,
      minNextBid: 31_500,
      version: 1,
    });
    const detail = 'Buy Now is no longer available: bidding has reached the Buy Now price.';
    await setUp(OFFERED, {
      buyNow: throwError(() => new ApiProblem(409, 'BUY_NOW_UNAVAILABLE', detail, withdrawn)),
    });
    buyNowButton()!.click();
    await fixture.whenStable();

    expect(text('.message')).toBe(detail);
    expect(text('.price')).toBe('$31,000');
    expect(buyNowButton()).toBeNull();
  });

  it('shows the new price and minimum when a bid loses a race, and keeps bidding open', async () => {
    const raced = auctionState({ currentBid: 5_500, bidCount: 1, minNextBid: 5_600, version: 1 });
    const detail =
      'Another bid came in first. The current bid is now $5,500, and the minimum next bid is $5,600.';
    await setUp(auctionState(), {
      placeBid: throwError(() => new ApiProblem(409, 'PRICE_CHANGED', detail, raced)),
    });
    element.querySelector<HTMLButtonElement>('button.bid-button')!.click();
    await fixture.whenStable();

    expect(text('.message')).toBe(detail);
    expect(text('.price')).toBe('$5,500');
    expect(text('.bid-button')).toBe('Bid $5,600');
    expect(element.querySelector<HTMLButtonElement>('button.bid-button')!.disabled).toBe(false);
  });

  it('shows a successful bid as the high bidder', async () => {
    const accepted = auctionState({
      currentBid: 5_500,
      bidCount: 1,
      minNextBid: 5_600,
      viewer: { isHighBidder: true, hasBid: true, purchased: false },
      version: 1,
    });
    await setUp(auctionState(), { placeBid: of(accepted) });
    element.querySelector<HTMLButtonElement>('button.bid-button')!.click();
    await fixture.whenStable();

    expect(text('.position')).toBe("emoji_events You're the high bidder");
    expect(text('.message')).toBe("Your $5,500 bid was placed. You're the high bidder.");
    expect(element.querySelector<HTMLButtonElement>('button.bid-button')!.disabled).toBe(true);
  });

  describe('changes over the live stream', () => {
    const LEADING = auctionState({
      currentBid: 5_500,
      bidCount: 1,
      minNextBid: 5_600,
      viewer: { isHighBidder: true, hasBid: true, purchased: false },
      version: 1,
    });
    const stream = (state: AuctionState) => TestBed.inject(AuctionStateService).apply(state);

    it('tells the buyer when a rival outbids them, with the new minimum', async () => {
      await setUp(LEADING);
      stream(
        auctionState({
          currentBid: 5_600,
          bidCount: 2,
          minNextBid: 5_700,
          viewer: { isHighBidder: false, hasBid: true, purchased: false },
          version: 2,
        }),
      );
      await fixture.whenStable();

      expect(text('.position')).toBe("error_outline You've been outbid");
      expect(text('.message')).toBe(
        "You've been outbid: another bidder bid $5,600. The minimum next bid is $5,700.",
      );
      expect(text('.bid-button')).toBe('Bid $5,700');
      expect(element.querySelector<HTMLButtonElement>('button.bid-button')!.disabled).toBe(false);
      expect(element.querySelector('.price.changed')).not.toBeNull();
    });

    it('drops an earlier message once the auction ends, and shows the outcome', async () => {
      await setUp(auctionState(), { placeBid: of(LEADING) });
      element.querySelector<HTMLButtonElement>('button.bid-button')!.click();
      await fixture.whenStable();
      expect(text('.message')).toContain('bid was placed');

      stream({ ...LEADING, status: 'ended', minNextBid: null, outcome: 'sold' });
      await fixture.whenStable();

      expect(element.querySelector('.message')).toBeNull();
      expect(text('.outcome')).toBe('You won this auction at $5,500');
    });

    it('does not highlight the price the page opened with', async () => {
      await setUp(LEADING);
      expect(element.querySelector('.price')).not.toBeNull();
      expect(element.querySelector('.price.changed')).toBeNull();
    });
  });
});
