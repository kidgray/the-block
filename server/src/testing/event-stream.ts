import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Express } from 'express';

export interface StreamEvent {
  event: string;
  data: string;
}

export interface EventStreamClient {
  status: number;
  headers: Headers;
  /** Resolves with the next event (or comment, as event ':'), or rejects after the timeout. */
  next(timeoutMs?: number): Promise<StreamEvent>;
  close(): void;
}

/** Starts the app on a random port, for tests that need a real connection (SSE). */
export async function listen(app: Express): Promise<{ baseUrl: string; close(): Promise<void> }> {
  const server: Server = await new Promise((resolve) => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** A minimal Server-Sent Events reader over fetch, for asserting on what the server writes. */
export async function openEventStream(url: string, cookie?: string): Promise<EventStreamClient> {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: { Accept: 'text/event-stream', ...(cookie && { Cookie: cookie }) },
    signal: controller.signal,
  });
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  const queued: StreamEvent[] = [];
  let buffer = '';
  // A read that outlives a timed-out `next()` is kept, so its chunk is not lost.
  let pendingRead: ReturnType<typeof reader.read> | null = null;

  const parseBlocks = () => {
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (block.startsWith(':')) {
        queued.push({ event: ':', data: block.slice(1).trim() });
        continue;
      }
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trim());
      }
      if (data.length > 0) queued.push({ event, data: data.join('\n') });
    }
  };

  return {
    status: response.status,
    headers: response.headers,
    async next(timeoutMs = 2_000) {
      const deadline = Date.now() + timeoutMs;
      while (queued.length === 0) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('No event arrived in time');
        pendingRead ??= reader.read();
        const chunk = await Promise.race([
          pendingRead,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining)),
        ]);
        if (chunk === null) throw new Error('No event arrived in time');
        pendingRead = null;
        if (chunk.done) throw new Error('The stream ended');
        buffer += chunk.value;
        parseBlocks();
      }
      return queued.shift()!;
    },
    close: () => controller.abort(),
  };
}
