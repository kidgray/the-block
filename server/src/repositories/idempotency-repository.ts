import type { Db } from '../db/connection.js';

export interface IdempotencyRecord {
  userId: string;
  key: string;
  endpoint: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: number;
}

interface IdempotencyRow {
  request_hash: string;
  endpoint: string;
  response_status: number;
  response_body: string;
  created_at: number;
}

export class IdempotencyRepository {
  constructor(private readonly db: Db) {}

  find(userId: string, key: string): IdempotencyRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT request_hash, endpoint, response_status, response_body, created_at
         FROM idempotency_keys WHERE user_id = ? AND idempotency_key = ?`,
      )
      .get(userId, key) as IdempotencyRow | undefined;
    return (
      row && {
        userId,
        key,
        endpoint: row.endpoint,
        requestHash: row.request_hash,
        responseStatus: row.response_status,
        responseBody: JSON.parse(row.response_body) as unknown,
        createdAt: row.created_at,
      }
    );
  }

  save(record: IdempotencyRecord): void {
    this.db
      .prepare(
        `INSERT INTO idempotency_keys
           (user_id, idempotency_key, endpoint, request_hash, response_status, response_body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.userId,
        record.key,
        record.endpoint,
        record.requestHash,
        record.responseStatus,
        JSON.stringify(record.responseBody),
        record.createdAt,
      );
  }
}
