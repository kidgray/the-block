import { HttpContextToken } from '@angular/common/http';

/** The idempotency key for a bid; the interceptor sends it as the `Idempotency-Key` header. */
export const IDEMPOTENCY_KEY = new HttpContextToken<string | null>(() => null);
