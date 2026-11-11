/// <reference types="jest" />
/**
 * Tests for POST /api/internal/signals/ingest — the HMAC-authenticated
 * worker -> Next.js signal ingestion endpoint.
 *
 * Covers: valid signature storage, invalid/stale signatures, malformed
 * JSON, invalid payloads, duplicate signals, and missing secret config.
 */

import crypto from 'crypto';

const insertOne = jest.fn();
const collection = jest.fn(() => ({ insertOne }));

jest.mock('mongoose', () => ({
  connection: { db: { collection } },
}));

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({}),
}));

import { POST } from './route';

const SECRET = 'test-worker-secret';

const VALID_PAYLOAD = {
  chat_id: -5324198757,
  message_id: 1661,
  group_name: 'BOT TESTING',
  symbol: 'XAUUSDm',
  direction: 'BUY',
  order_type: 'PENDING',
  entry: 4053.0,
  entry_high: null,
  entry_low: null,
  stop_loss: 4049.0,
  take_profits: [4058.0],
  raw_message: 'BUY XAUUSDm 4053 SL 4049 TP 4058',
  confidence: 90,
  timestamp: '2026-11-10T23:30:17Z',
};

function signedRequest(
  payload: unknown = VALID_PAYLOAD,
  opts: { secret?: string; stale?: boolean; badSig?: boolean } = {}
): Request {
  const body =
    typeof payload === 'string' ? payload : JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000) - (opts.stale ? 3600 : 0);
  const sig = opts.badSig
    ? 'deadbeef'.repeat(8)
    : crypto
        .createHmac('sha256', opts.secret ?? SECRET)
        .update(`${ts}.${body}`, 'utf8')
        .digest('hex');

  return new Request('http://localhost/api/internal/signals/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': sig,
      'X-Timestamp': String(ts),
    },
    body,
  });
}

describe('POST /api/internal/signals/ingest', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, WORKER_HMAC_SECRET: SECRET };
    insertOne.mockReset();
    collection.mockClear();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('stores a valid signed signal and returns stored+id', async () => {
    insertOne.mockResolvedValue({ insertedId: { toString: () => 'abc123' } });
    const res = await POST(signedRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('stored');
    expect(json.id).toBe('abc123');

    expect(collection).toHaveBeenCalledWith('signals');
    const doc = insertOne.mock.calls[0][0];
    expect(doc.chat_id).toBe(-5324198757);
    expect(doc.message_id).toBe(1661);
    expect(doc.symbol).toBe('XAUUSDm');
    expect(doc.direction).toBe('BUY');
    expect(doc.status).toBe('RECEIVED');
    expect(doc.ingested_at).toBeInstanceOf(Date);
  });

  it('rejects an invalid signature with 401', async () => {
    const res = await POST(signedRequest(VALID_PAYLOAD, { badSig: true }));
    expect(res.status).toBe(401);
    expect(insertOne).not.toHaveBeenCalled();
  });

  it('rejects a signature made with the wrong secret', async () => {
    const res = await POST(
      signedRequest(VALID_PAYLOAD, { secret: 'wrong-secret' })
    );
    expect(res.status).toBe(401);
    expect(insertOne).not.toHaveBeenCalled();
  });

  it('rejects a stale timestamp (replay) with 401', async () => {
    const res = await POST(signedRequest(VALID_PAYLOAD, { stale: true }));
    expect(res.status).toBe(401);
    expect(insertOne).not.toHaveBeenCalled();
  });

  it('rejects missing signature headers with 401', async () => {
    const req = new Request('http://localhost/api/internal/signals/ingest', {
      method: 'POST',
      body: JSON.stringify(VALID_PAYLOAD),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects malformed JSON with 422', async () => {
    const res = await POST(signedRequest('{not json'));
    expect(res.status).toBe(422);
    expect(insertOne).not.toHaveBeenCalled();
  });

  it('rejects invalid direction with 422', async () => {
    const res = await POST(
      signedRequest({ ...VALID_PAYLOAD, direction: 'HOLD' })
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('Invalid direction');
  });

  it('rejects empty take_profits with 422', async () => {
    const res = await POST(
      signedRequest({ ...VALID_PAYLOAD, take_profits: [] })
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('No take profit levels');
  });

  it('rejects non-positive entry with 422', async () => {
    const res = await POST(signedRequest({ ...VALID_PAYLOAD, entry: 0 }));
    expect(res.status).toBe(422);
  });

  it('returns duplicate on unique-index conflict (code 11000)', async () => {
    insertOne.mockRejectedValue(
      Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
    );
    const res = await POST(signedRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('duplicate');
  });

  it('returns 503 when WORKER_HMAC_SECRET is not configured', async () => {
    delete process.env.WORKER_HMAC_SECRET;
    const res = await POST(signedRequest());
    expect(res.status).toBe(503);
    expect(insertOne).not.toHaveBeenCalled();
  });
});
