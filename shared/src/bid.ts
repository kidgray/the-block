import { z } from 'zod';

/** Body of `POST /api/vehicles/:vehicleId/bids` (design §12.4). */
export const PlaceBidRequestSchema = z.object({
  amount: z.int().positive(),
  /** The current bid the buyer confirmed against, or null if the vehicle had no bids. */
  expectedCurrentBid: z.int().nonnegative().nullable(),
});
export type PlaceBidRequest = z.infer<typeof PlaceBidRequestSchema>;

/** Body of `POST /api/vehicles/:vehicleId/buy-now`: always `{}` (design §12.4). */
export const BuyNowRequestSchema = z.strictObject({});
