import { z } from 'zod';
import { AUCTION_STATUSES } from './constants.js';

export const AuctionStatusSchema = z.enum(AUCTION_STATUSES);

export const ReserveStatusSchema = z.enum(['none', 'not_met', 'met']);
export type ReserveStatus = z.infer<typeof ReserveStatusSchema>;

export const AuctionOutcomeSchema = z.enum(['sold', 'sold_buy_now', 'reserve_not_met', 'no_sale']);
export type AuctionOutcome = z.infer<typeof AuctionOutcomeSchema>;

/** Viewer-specific facts; null when the viewer is signed out. */
export const AuctionViewerSchema = z.object({
  isHighBidder: z.boolean(),
  hasBid: z.boolean(),
  /** The viewer bought this vehicle through Buy Now. */
  purchased: z.boolean(),
});
export type AuctionViewer = z.infer<typeof AuctionViewerSchema>;

/** A complete snapshot of one vehicle's auction, as seen by one viewer (design §11.4). */
export const AuctionStateSchema = z.object({
  status: AuctionStatusSchema,
  auctionStart: z.iso.datetime(),
  auctionEnd: z.iso.datetime(),
  startingBid: z.int().nonnegative(),
  currentBid: z.int().nonnegative().nullable(),
  bidCount: z.int().nonnegative(),
  /** Null once the auction has ended. */
  minNextBid: z.int().positive().nullable(),
  reserveStatus: ReserveStatusSchema,
  buyNowPrice: z.int().positive().nullable(),
  buyNowAvailable: z.boolean(),
  /** Null until the auction has ended. */
  outcome: AuctionOutcomeSchema.nullable(),
  viewer: AuctionViewerSchema.nullable(),
  version: z.int().nonnegative(),
  serverTime: z.iso.datetime(),
});
export type AuctionState = z.infer<typeof AuctionStateSchema>;
