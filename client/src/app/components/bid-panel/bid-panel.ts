import { LiveAnnouncer } from '@angular/cdk/a11y';
import type { ComponentType } from '@angular/cdk/portal';
import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import type { ErrorStateMatcher } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MAX_BID_AMOUNT, type AuctionState } from '@the-block/shared';
import {
  BehaviorSubject,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  type Observable,
  of,
  pairwise,
  switchMap,
  take,
} from 'rxjs';
import { BidsApi, newIdempotencyKey } from '../../core/api/bids-api';
import { ApiProblem } from '../../core/http/api-problem';
import { SessionService } from '../../core/session/session.service';
import { SignInService } from '../../core/session/sign-in.service';
import { AuctionStateService } from '../../services/auction-state.service';
import { CadPipe, formatCad } from '../../shared/format/format';
import { BidConfirmDialog, type BidConfirmData } from '../bid-confirm-dialog/bid-confirm-dialog';
import {
  BuyNowConfirmDialog,
  type BuyNowConfirmData,
} from '../buy-now-confirm-dialog/buy-now-confirm-dialog';
import { Countdown } from '../countdown/countdown';
import { StatusChip } from '../status-chip/status-chip';

interface PanelState {
  pending: boolean;
  message: { tone: 'success' | 'error'; text: string } | null;
}

/** One buyer action on this auction: a bid or a Buy Now purchase. */
interface PanelAction {
  /** Why the action can no longer go ahead on the latest state, or null if it can. */
  blocker(state: AuctionState): string | null;
  /** Asks the buyer to confirm the exact amount. */
  confirm(): Observable<boolean>;
  /** Sends the action with a fresh idempotency key, against the state the buyer confirmed. */
  submit(state: AuctionState, idempotencyKey: string): Observable<AuctionState>;
  successText(state: AuctionState): string;
}

const RESERVE_LABELS = { none: 'No reserve', met: 'Met', not_met: 'Not met' } as const;

function wholeDollars(control: AbstractControl<number | null>): ValidationErrors | null {
  return control.value === null || Number.isInteger(control.value) ? null : { wholeDollars: true };
}

/**
 * Shows amount errors as the buyer types, not only after the field loses focus, so a disabled
 * "Place bid" button always has a visible reason. It ignores the form's submitted flag, so the
 * field doesn't turn red when it is cleared after a successful bid.
 */
const ERRORS_WHILE_TYPING: ErrorStateMatcher = {
  isErrorState: (control) => Boolean(control?.invalid && (control.dirty || control.touched)),
};

@Component({
  selector: 'app-bid-panel',
  imports: [
    AsyncPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    CadPipe,
    Countdown,
    StatusChip,
  ],
  templateUrl: './bid-panel.html',
  styleUrl: './bid-panel.scss',
})
export class BidPanel {
  private readonly auction = inject(AuctionStateService);
  private readonly bidsApi = inject(BidsApi);
  private readonly session = inject(SessionService);
  private readonly signIn = inject(SignInService);
  private readonly dialog = inject(MatDialog);
  private readonly announcer = inject(LiveAnnouncer);

  @Input({ required: true }) vehicleId!: string;
  @Input({ required: true }) vehicleTitle!: string;

  protected readonly state$ = this.auction.state$;
  /** The version the page opened with: later price changes are highlighted. */
  protected readonly firstVersion$ = this.state$.pipe(
    take(1),
    map((state) => state.version),
  );
  protected readonly panel$ = new BehaviorSubject<PanelState>({ pending: false, message: null });
  protected readonly customAmount = new FormControl<number | null>(null);
  /** `[formGroup]` makes the form emit `ngSubmit` and stops the browser's native submit (a page reload). */
  protected readonly bidForm = new FormGroup({ amount: this.customAmount });
  protected readonly errorsWhileTyping = ERRORS_WHILE_TYPING;
  protected readonly maxBid = MAX_BID_AMOUNT;
  protected readonly reserveLabels = RESERVE_LABELS;

  constructor() {
    // Keep the custom-amount validators in step with the server's minimum next bid.
    this.state$
      .pipe(
        map((state) => state.minNextBid),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((minimum) => {
        this.customAmount.setValidators([
          Validators.required,
          Validators.min(minimum ?? 0),
          Validators.max(MAX_BID_AMOUNT),
          wholeDollars,
        ]);
        this.customAmount.updateValueAndValidity({ emitEvent: false });
      });

    // Changes that arrive over the live stream (design §8.7): tell the buyer they were outbid, and
    // drop a message about a bid once the auction has moved on to another status.
    this.state$.pipe(pairwise(), takeUntilDestroyed()).subscribe(([previous, next]) => {
      if (this.panel$.value.pending) return;
      if (previous.viewer?.isHighBidder && next.viewer && !next.viewer.isHighBidder) {
        if (next.status === 'live') {
          this.finish(
            'error',
            `You've been outbid: another bidder bid ${formatCad(next.currentBid ?? 0)}. The minimum next bid is ${formatCad(next.minNextBid ?? 0)}.`,
          );
          return;
        }
      }
      if (previous.status !== next.status) {
        this.panel$.next({ pending: false, message: null });
        if (next.status === 'ended')
          void this.announcer.announce(this.outcomeLabel(next), 'polite');
      }
    });
  }

  protected bidMinimum(state: AuctionState): void {
    if (state.minNextBid !== null) this.placeBid(state.minNextBid, state.currentBid);
  }

  protected bidCustom(state: AuctionState): void {
    this.customAmount.markAsTouched();
    const amount = this.customAmount.value;
    if (this.customAmount.valid && amount !== null) this.placeBid(amount, state.currentBid);
  }

  /** Design §8.5: confirm the Buy Now price, then end the auction as a sale to the buyer. */
  protected buyNow(state: AuctionState): void {
    const price = state.buyNowPrice;
    if (price === null) return;
    this.run({
      blocker: (latest) => {
        if (latest.viewer?.purchased) return "You've already bought this vehicle.";
        if (latest.status !== 'live') return 'This auction has ended.';
        return latest.buyNowAvailable
          ? null
          : 'Buy Now is no longer available: bidding has reached the Buy Now price.';
      },
      confirm: () =>
        this.openConfirm<BuyNowConfirmDialog, BuyNowConfirmData>(BuyNowConfirmDialog, {
          vehicleTitle: this.vehicleTitle,
          price,
        }),
      submit: (_latest, key) => this.bidsApi.buyNow(this.vehicleId, key),
      successText: () => `Purchase confirmed: the ${this.vehicleTitle} is yours.`,
    });
  }

  /** The headline price: what was paid once bought outright, otherwise the current or starting bid. */
  protected priceFact(state: AuctionState): { label: string; amount: number } {
    if (state.outcome === 'sold_buy_now' && state.buyNowPrice !== null) {
      return { label: 'Sold through Buy Now', amount: state.buyNowPrice };
    }
    if (state.currentBid === null) return { label: 'Starting bid', amount: state.startingBid };
    return {
      label: state.status === 'ended' ? 'Final bid' : 'Current bid',
      amount: state.currentBid,
    };
  }

  protected outcomeLabel(state: AuctionState): string {
    switch (state.outcome) {
      case 'sold':
        return state.viewer?.isHighBidder
          ? `You won this auction at ${formatCad(state.currentBid ?? 0)}`
          : `Sold for ${formatCad(state.currentBid ?? 0)}`;
      case 'sold_buy_now':
        return state.viewer?.purchased
          ? `You bought this vehicle for ${formatCad(state.buyNowPrice ?? 0)}`
          : 'Sold through Buy Now';
      case 'reserve_not_met':
        return 'Ended without a sale: the reserve was not met';
      case 'no_sale':
        return 'Ended with no bids';
      default:
        return 'This auction has ended';
    }
  }

  /** Bids against the price the buyer was looking at (design §8.7, D18). */
  private placeBid(amount: number, seenCurrentBid: number | null): void {
    this.run({
      blocker: (latest) => {
        if (latest.viewer?.isHighBidder) return "You're already the high bidder.";
        if (latest.currentBid !== seenCurrentBid) {
          return `The price changed while you were signing in. The minimum bid is now ${formatCad(latest.minNextBid ?? 0)}.`;
        }
        return null;
      },
      confirm: () =>
        this.openConfirm<BidConfirmDialog, BidConfirmData>(BidConfirmDialog, {
          vehicleTitle: this.vehicleTitle,
          amount,
        }),
      submit: (latest, key) =>
        this.bidsApi.placeBid(
          this.vehicleId,
          { amount, expectedCurrentBid: latest.currentBid },
          key,
        ),
      successText: () => `Your ${formatCad(amount)} bid was placed. You're the high bidder.`,
    });
  }

  /**
   * Sign in if needed → re-check the latest state → confirm → submit. Signing in changes who is
   * looking, so the state is reloaded before the buyer confirms. Nothing is shown as accepted
   * until the server confirms it.
   */
  private run(action: PanelAction): void {
    const wasSignedIn = Boolean(this.session.currentUser);
    this.panel$.next({ pending: false, message: null });
    this.signIn
      .ensureSignedIn()
      .pipe(
        filter(Boolean),
        switchMap(() => (wasSignedIn ? of(this.auction.snapshot) : this.auction.reload())),
        filter((state): state is AuctionState => state !== null),
        switchMap((state) => {
          const blocker = action.blocker(state);
          if (blocker) {
            this.finish('error', blocker);
            return EMPTY;
          }
          return action.confirm().pipe(
            filter(Boolean),
            map(() => state),
          );
        }),
        switchMap((state) => {
          this.panel$.next({ pending: true, message: null });
          return action.submit(state, newIdempotencyKey());
        }),
      )
      .subscribe({
        next: (updated) => {
          this.auction.apply(updated);
          this.customAmount.reset();
          this.finish('success', action.successText(updated));
        },
        error: (error: unknown) => {
          const problem = ApiProblem.from(error);
          if (problem.auction) this.auction.apply(problem.auction);
          this.finish('error', problem.detail);
        },
      });
  }

  private openConfirm<C, D>(component: ComponentType<C>, data: D): Observable<boolean> {
    return this.dialog
      .open<C, D, boolean>(component, {
        data,
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(map(Boolean));
  }

  private finish(tone: 'success' | 'error', text: string): void {
    this.panel$.next({ pending: false, message: { tone, text } });
    void this.announcer.announce(text, tone === 'error' ? 'assertive' : 'polite');
  }
}
