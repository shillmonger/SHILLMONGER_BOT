import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import {
  parseSignalPayload,
  verifyWorkerSignature,
} from '@/lib/signal-ingest';

/**
 * POST /api/internal/signals/ingest
 *
 * Receives validated trading signals from the SHILLMONGER Python Telegram
 * worker. Authentication is HMAC-SHA256 (X-Signature / X-Timestamp headers),
 * NOT a user session — this route is excluded from middleware auth.
 *
 * Deduplication relies on the unique (chat_id, message_id) index that the
 * Python service creates on the shared `signals` collection.
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

    // Raw body is required verbatim for HMAC verification.
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature');
    const timestamp = request.headers.get('x-timestamp');

    if (
      !verifyWorkerSignature(rawBody, signature, timestamp, secret)
    ) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid payload: malformed JSON' },
        { status: 422 }
      );
    }

    const parsed = parseSignalPayload(payload);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }

    await connectDB();
    const collection = mongoose.connection.db!.collection('signals');

    const doc = {
      ...parsed.signal,
      status: 'RECEIVED',
      ingested_at: new Date(),
    };

    // Application-level dedup — same checks the Python service performs.
    // 1) Same Telegram message redelivered.
    const existing = await collection.findOne({
      chat_id: doc.chat_id,
      message_id: doc.message_id,
    });
    if (existing) {
      return NextResponse.json({
        status: 'duplicate',
        message: 'Signal already stored',
      });
    }

    // 2) Content-level dedup: identical trade parameters reposted as a NEW
    //    Telegram message within the window count as duplicates.
    const windowSeconds = Number(
      process.env.SIGNAL_DEDUP_WINDOW_SECONDS ?? 900
    );
    const contentDupe = await collection.findOne({
      chat_id: doc.chat_id,
      symbol: doc.symbol,
      direction: doc.direction,
      entry: doc.entry,
      stop_loss: doc.stop_loss,
      take_profits: doc.take_profits,
      ingested_at: {
        $gte: new Date(Date.now() - windowSeconds * 1000),
      },
    });
    if (contentDupe) {
      return NextResponse.json({
        status: 'duplicate',
        message: 'Signal already stored',
      });
    }

    try {
      const result = await collection.insertOne(doc);

      // Kick off personal-bot execution for the stored signal. Runs
      // asynchronously — the ingest ack must not wait for broker I/O, and
      // the engine performs its own eligibility/risk checks. Duplicate
      // executions are impossible (unique chatId+messageId index).
      const stored = { ...doc, _id: result.insertedId };
      import('@/lib/trading-engine')
        .then(({ executeSignal }) => executeSignal(stored))
        .catch((e) => console.error('[ingest] trading engine error:', e));

      return NextResponse.json({
        status: 'stored',
        id: result.insertedId.toString(),
      });
    } catch (error) {
      // Unique (chat_id, message_id) index -> duplicate delivery
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: number }).code === 11000
      ) {
        return NextResponse.json({
          status: 'duplicate',
          message: 'Signal already stored',
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Signal ingest error:', error);
    return NextResponse.json(
      { error: 'Failed to store signal' },
      { status: 500 }
    );
  }
}
