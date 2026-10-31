import { InjectionToken } from '@angular/core';

/** Opens a Server-Sent Events connection. A token, so tests can replace the browser's EventSource. */
export type EventSourceFactory = (url: string) => EventSource;

export const EVENT_SOURCE = new InjectionToken<EventSourceFactory>('EVENT_SOURCE', {
  providedIn: 'root',
  factory: () => (url) => new EventSource(url),
});

/** `EventSource.CLOSED`, spelled out so code also runs where EventSource is missing (tests). */
export const EVENT_SOURCE_CLOSED = 2;
