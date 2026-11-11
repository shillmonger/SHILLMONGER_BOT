/**
 * Worker -> backend signal ingestion helpers.
 *
 * Mirrors the Python bot's contract exactly (SHILLMONGER_BOT/core/security.py
 * and api_server.py SignalIngestRequest):
 *
 *   signature = HMAC_SHA256(secret, "{timestamp}.{raw_body}").hexdigest()
 *
 * Headers: X-Signature, X-Timestamp. Stale timestamps (> max age) are rejected
 * to prevent replay. The same WORKER_HMAC_SECRET value must be configured on
 * both the Python worker and this Next.js app.
 */

import crypto from 'crypto';

export const SIGNATURE_MAX_AGE_SECONDS = 300;

export interface VerifiedSignal {
  chat_id: number;
  message_id: number;
  group_name: string;
  symbol: string;
  direction: string;
  order_type: string;
  entry: number;
  entry_high: number | null;
  entry_low: number | null;
  stop_loss: number;
  take_profits: number[];
  raw_message: string;
  confidence: number;
  timestamp?: string;
}

/**
 * Verify the worker's HMAC-SHA256 signature over "{timestamp}.{rawBody}".
 * Returns false for missing headers, stale timestamps, or bad signatures.
 */
export function verifyWorkerSignature(
  rawBody: string,
  signature: string | null,
  timestampHeader: string | null,
  secret: string,
  maxAgeSeconds: number = SIGNATURE_MAX_AGE_SECONDS,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!signature || !timestampHeader || !secret) return false;

  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > maxAgeSeconds) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toInt(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && Number.isInteger(n) ? n : null;
}

/**
 * Validate a parsed JSON payload against the SignalIngestRequest contract.
 * Returns the normalized signal or an error string mirroring the Python
 * endpoint's 422 responses.
 */
export function parseSignalPayload(
  body: unknown
): { ok: true; signal: VerifiedSignal } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Invalid payload: body must be an object' };
  }
  const p = body as Record<string, unknown>;

  const chatId = toInt(p.chat_id);
  const messageId = toInt(p.message_id);
  const symbol = typeof p.symbol === 'string' ? p.symbol : '';
  const direction = typeof p.direction === 'string' ? p.direction : '';
  const entry = toNumber(p.entry);
  const stopLoss = toNumber(p.stop_loss);
  const rawTps = Array.isArray(p.take_profits) ? p.take_profits : null;
  const takeProfits = rawTps ? rawTps.map(toNumber) : null;

  if (chatId === null || messageId === null || !symbol || !direction) {
    return { ok: false, error: 'Invalid payload: missing required fields' };
  }
  if (direction.toUpperCase() !== 'BUY' && direction.toUpperCase() !== 'SELL') {
    return { ok: false, error: 'Invalid direction' };
  }
  if (takeProfits === null || takeProfits.length === 0) {
    return { ok: false, error: 'No take profit levels' };
  }
  if (takeProfits.some((n) => n === null)) {
    return { ok: false, error: 'Invalid payload: take_profits must be numbers' };
  }
  if (entry === null || entry <= 0 || stopLoss === null || stopLoss <= 0) {
    return { ok: false, error: 'Invalid entry/stop loss' };
  }

  return {
    ok: true,
    signal: {
      chat_id: chatId,
      message_id: messageId,
      group_name: typeof p.group_name === 'string' ? p.group_name : 'Unknown',
      symbol,
      direction,
      order_type: typeof p.order_type === 'string' ? p.order_type : 'PENDING',
      entry,
      entry_high: toNumber(p.entry_high),
      entry_low: toNumber(p.entry_low),
      stop_loss: stopLoss,
      take_profits: takeProfits as number[],
      raw_message: typeof p.raw_message === 'string' ? p.raw_message : '',
      confidence: toNumber(p.confidence) ?? 0,
      timestamp: typeof p.timestamp === 'string' ? p.timestamp : undefined,
    },
  };
}
