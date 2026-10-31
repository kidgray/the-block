import { z } from 'zod';
import { MY_BID_STATUSES } from './constants.js';
import { VehicleSummarySchema } from './vehicle.js';

export const MyBidStatusSchema = z.enum(MY_BID_STATUSES);

/** One auction the buyer bid on or bought (design §7.5, §11.4). */
export const MyBidRowSchema = z.object({
  vehicle: VehicleSummarySchema,
  /** Null for a Buy Now purchase made without bidding. */
  myHighestBid: z.int().positive().nullable(),
  /** The current price while live; the final price once ended. */
  price: z.int().nonnegative(),
  status: MyBidStatusSchema,
});
export type MyBidRow = z.infer<typeof MyBidRowSchema>;

/** `GET /api/me/bids`. Active rows end soonest first; ended rows are most recent first. */
export const MyBidsResponseSchema = z.object({
  active: z.array(MyBidRowSchema),
  ended: z.array(MyBidRowSchema),
});
export type MyBidsResponse = z.infer<typeof MyBidsResponseSchema>;
