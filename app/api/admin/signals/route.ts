import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/signals?type=signals|pending&limit=500
 *
 * Reads the `signals` / `pending_signals` collections written by the Python
 * Telegram worker — no Mongoose models, the bot owns these collections.
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') === 'pending' ? 'pending' : 'signals';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '500', 10) || 500, 1), 2000);

    const collection = db.collection(type === 'pending' ? 'pending_signals' : 'signals');
    const sortField = type === 'pending' ? 'queued_at' : 'ingested_at';

    const docs = await collection
      .find({}, {
        projection: {
          chat_id: 1, message_id: 1, group_name: 1, symbol: 1, direction: 1,
          order_type: 1, entry: 1, entry_high: 1, entry_low: 1, stop_loss: 1,
          take_profits: 1, raw_message: 1, confidence: 1, timestamp: 1,
          status: 1, ingested_at: 1, queued_at: 1, attempts: 1,
        },
      })
      .sort({ [sortField]: -1, _id: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      type,
      signals: docs.map((d) => ({
        id: String(d._id),
        chat_id: d.chat_id ?? null,
        message_id: d.message_id ?? null,
        group_name: d.group_name ?? null,
        symbol: d.symbol ?? null,
        direction: d.direction ?? null,
        order_type: d.order_type ?? null,
        entry: d.entry ?? null,
        entry_high: d.entry_high ?? null,
        entry_low: d.entry_low ?? null,
        stop_loss: d.stop_loss ?? null,
        take_profits: Array.isArray(d.take_profits) ? d.take_profits : [],
        raw_message: d.raw_message ?? null,
        confidence: d.confidence ?? null,
        timestamp: d.timestamp ?? null,
        status: type === 'pending' ? 'PENDING' : (d.status ?? 'RECEIVED'),
        ingested_at: d.ingested_at ?? null,
        queued_at: d.queued_at ?? null,
        attempts: d.attempts ?? null,
      })),
    });
  } catch (error) {
    console.error('Admin signals GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
