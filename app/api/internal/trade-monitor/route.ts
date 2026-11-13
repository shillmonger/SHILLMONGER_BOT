import { NextResponse } from 'next/server';
import { verifyWorkerSignature } from '@/lib/signal-ingest';
import { syncTradeLifecycles } from '@/lib/trade-monitor';

export const maxDuration = 120;

/**
 * POST /api/internal/trade-monitor
 *
 * Called by the SHILLMONGER Python worker on an interval. Auth is the
 * same HMAC-SHA256 scheme as signal ingest (X-Signature / X-Timestamp).
 *
 * Optional JSON body: { "userId": "<mongo user id>" } to scope the sync
 * to one user; empty body sweeps every user with non-terminal trades.
 *
 * The route performs broker I/O (Capital.com orders/positions/history/
 * confirms) and reconciles TRADE_EXECUTIONS + SIGNAL_EVALUATIONS.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.WORKER_HMAC_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Worker auth not configured' },
        { status: 503 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-signature');
    const timestamp = request.headers.get('x-timestamp');

    if (!verifyWorkerSignature(rawBody, signature, timestamp, secret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    let userId: string | undefined;
    try {
      const parsed = JSON.parse(rawBody || '{}') as { userId?: unknown };
      if (typeof parsed.userId === 'string' && parsed.userId.trim()) {
        userId = parsed.userId.trim();
      }
    } catch {
      // Empty/invalid body is fine — sweep all users.
    }

    const summary = await syncTradeLifecycles(userId);
    return NextResponse.json({ status: 'ok', ...summary });
  } catch (error) {
    console.error('[trade-monitor] route error:', error);
    return NextResponse.json(
      { error: 'Trade monitor sync failed' },
      { status: 500 }
    );
  }
}
