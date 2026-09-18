import crypto from "crypto";
import { Request } from "express";
import { PoolClient } from "pg";
import { pool } from "..";
import { ErrorHandler } from "./ErrorHandler";
import logger from "./logger";

export const IDEMPOTENCY_HEADER = "idempotency-key";

// An IN_PROGRESS row whose owner died (process restart, container kill) would
// otherwise wedge that key forever and the customer could never place the
// order. Anything older than this is treated as abandoned and taken over.
// Generous on purpose: the slowest thing inside the reservation is the payment
// gateway call, which is measured in seconds, not minutes.
const STALE_IN_PROGRESS_MS = 2 * 60 * 1000;

export type TIdempotencyStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type TIdempotencyReservation =
  | { reserved: true; recordId: number }
  | {
      reserved: false;
      status: number;
      message: string;
      data: any;
    };

/**
 * JSON.stringify with object keys sorted at every level, so two payloads that
 * differ only in key order hash the same. Without this a retry that happens to
 * serialise its fields in a different order would look like a different
 * request and be rejected.
 */
const stableStringify = (value: any): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

export const hashRequestPayload = (payload: unknown) =>
  crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");

/**
 * Pull the Idempotency-Key header off the request and sanity check it. The key
 * is required : letting a request through without one would silently reopen
 * the duplicate-order hole this whole mechanism exists to close.
 */
export const readIdempotencyKey = (req: Request): string => {
  const raw = req.headers[IDEMPOTENCY_HEADER];
  const key = Array.isArray(raw) ? raw[0] : raw;

  if (!key || typeof key !== "string" || key.trim() === "") {
    throw new ErrorHandler(400, "Idempotency-Key header is required");
  }

  const trimmed = key.trim();

  // Long enough to be unguessable, short enough that it is not a payload.
  // A UUID v4 (36 chars) sits comfortably inside this.
  if (trimmed.length < 16 || trimmed.length > 128) {
    throw new ErrorHandler(
      400,
      "Idempotency-Key must be between 16 and 128 characters",
    );
  }

  return trimmed;
};

/**
 * Claim the key for this request.
 *
 * Runs on the pool directly, NOT on the caller's transaction client, and so
 * commits the moment it returns. That is the whole point: a duplicate request
 * arriving a millisecond later must be able to see the reservation, which it
 * could not if the row were still inside an uncommitted order transaction.
 *
 * Returns `{ reserved: true }` when this request owns the key and should go on
 * to do the work, or `{ reserved: false, ... }` carrying the response to send
 * back instead.
 */
export const reserveIdempotencyKey = async ({
  key,
  userId,
  endpoint,
  requestHash,
}: {
  key: string;
  userId: number;
  endpoint: string;
  requestHash: string;
}): Promise<TIdempotencyReservation> => {
  const inserted = await pool.query(
    `INSERT INTO idempotency_keys
        (idempotency_key, user_id, endpoint, request_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint, idempotency_key) DO NOTHING
     RETURNING id`,
    [key, userId, endpoint, requestHash],
  );

  if (inserted.rowCount === 1) {
    return { reserved: true, recordId: inserted.rows[0].id };
  }

  // Someone got here first. Read what they left behind.
  const { rows } = await pool.query(
    `SELECT id, status, request_hash, order_id, response_status, response_message, response_body, updated_at
       FROM idempotency_keys
      WHERE user_id = $1 AND endpoint = $2 AND idempotency_key = $3`,
    [userId, endpoint, key],
  );

  // Vanishingly unlikely (the row would have to be deleted between the two
  // statements) but treat it as "not ours" rather than crashing.
  if (rows.length === 0) {
    throw new ErrorHandler(
      409,
      "Could not reserve this request, please try again",
    );
  }

  const record = rows[0];

  // Same key, different payload. This is a client bug — replaying the first
  // order's response would tell the customer the wrong thing was ordered.
  if (record.request_hash !== requestHash) {
    throw new ErrorHandler(
      422,
      "This Idempotency-Key was already used with a different request",
    );
  }

  if (record.status === "COMPLETED") {
    return {
      reserved: false,
      status: record.response_status ?? 200,
      message: record.response_message ?? "Request already processed",
      data: record.response_body ?? null,
    };
  }

  if (record.status === "IN_PROGRESS") {
    const age = Date.now() - new Date(record.updated_at).getTime();

    if (age < STALE_IN_PROGRESS_MS) {
      // The original is still working. Tell the client to come back rather
      // than holding this request (and a db connection) open behind a lock.
      throw new ErrorHandler(
        409,
        "This order is already being placed, please wait a moment",
      );
    }

    // Stale, but order_id is set — which is only written inside the order
    // transaction, so the order DID commit and only the bookkeeping after it
    // was lost (process killed mid-response). Recreating it here would be the
    // exact duplicate this module exists to prevent.
    //
    // The original response is gone, so a gateway URL cannot be replayed. A
    // null one sends the customer to their orders list, where an unpaid ONLINE
    // order can be paid from.
    if (record.order_id != null) {
      logger.error({
        message:
          "Idempotency key left IN_PROGRESS by a committed order, replaying without a gateway url",
        recordId: record.id,
        orderId: record.order_id,
        endpoint,
      });

      return {
        reserved: false,
        status: 200,
        message: "This order has already been placed",
        data: { gatewayUrl: null },
      };
    }

    logger.error({
      message: "Taking over a stale IN_PROGRESS idempotency key",
      recordId: record.id,
      endpoint,
      ageMs: age,
    });
  }

  // FAILED, or a stale IN_PROGRESS whose owner is gone. The order transaction
  // rolled back in both cases, so nothing was created and the key is free to
  // reuse. The status guard makes the takeover atomic: if two retries race
  // here only one UPDATE matches.
  const takenOver = await pool.query(
    `UPDATE idempotency_keys
        SET status = 'IN_PROGRESS', updated_at = NOW()
      WHERE id = $1 AND status = $2
      RETURNING id`,
    [record.id, record.status],
  );

  if (takenOver.rowCount !== 1) {
    throw new ErrorHandler(
      409,
      "This order is already being placed, please wait a moment",
    );
  }

  return { reserved: true, recordId: record.id };
};

/**
 * Bind the key to the order it created, ON THE ORDER'S OWN TRANSACTION CLIENT
 * so it commits or rolls back with the order and can never disagree with it.
 *
 * This is what makes the stale-key takeover in reserveIdempotencyKey safe: a
 * row still IN_PROGRESS with an order_id is proof the order committed and only
 * the response bookkeeping was lost, so it must never be retried.
 */
export const attachOrderToIdempotencyKey = async (
  client: PoolClient,
  recordId: number,
  orderId: number,
) => {
  await client.query(
    `UPDATE idempotency_keys SET order_id = $2, updated_at = NOW() WHERE id = $1`,
    [recordId, orderId],
  );
};

/**
 * The work committed. Store the exact reply so a later retry with the same key
 * gets the same answer — for ONLINE that includes the gateway URL, so a
 * duplicate lands on the same payment page instead of a second one.
 */
export const completeIdempotencyKey = async ({
  recordId,
  orderId,
  status,
  message,
  data,
}: {
  recordId: number;
  orderId: number | null;
  status: number;
  message: string;
  data: any;
}) => {
  await pool.query(
    `UPDATE idempotency_keys
        SET status = 'COMPLETED',
            order_id = $2,
            response_status = $3,
            response_message = $4,
            response_body = $5,
            updated_at = NOW()
      WHERE id = $1`,
    [recordId, orderId, status, message, JSON.stringify(data ?? null)],
  );
};

/**
 * The work rolled back, so the key must not stay reserved — the customer has
 * to be able to fix whatever failed and submit again with the same key.
 *
 * Never throws: this runs on an error path, and losing the release is far less
 * bad than masking the original failure the customer needs to see.
 */
export const releaseIdempotencyKey = async (recordId: number) => {
  try {
    await pool.query(
      `UPDATE idempotency_keys
          SET status = 'FAILED', updated_at = NOW()
        WHERE id = $1 AND status = 'IN_PROGRESS'`,
      [recordId],
    );
  } catch (e: any) {
    logger.error({
      message: "Failed to release idempotency key",
      recordId,
      error: e?.message,
    });
  }
};
