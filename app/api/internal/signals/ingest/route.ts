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

    // Application-level dedup on (chat_id, message_id) — same check the
    // Python service performs. The unique signal_dedup index remains the
    // final guarantee against races.
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

    try {
      const result = await collection.insertOne(doc);
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
