import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
});
export type User = z.infer<typeof UserSchema>;

/** `GET /api/session`: who is signed in, if anyone. Signed out is a normal state, not an error. */
export const SessionStateSchema = z.object({
  user: UserSchema.nullable(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;
