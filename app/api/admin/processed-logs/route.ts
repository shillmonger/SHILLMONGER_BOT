import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import TelegramProvider from '@/models/TelegramProvider';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/processed-logs
 * Reads the worker-written `processed_messages` collection (created by the
 * Python bot — no Mongoose model needed) and joins each record to its
 * Telegram provider via chat_id -> telegramproviders.groupId.
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '500', 10) || 500, 1), 2000);

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const [messages, providers] = await Promise.all([
      db
        .collection('processed_messages')
        .find({}, { projection: { chat_id: 1, message_id: 1, processed_at: 1 } })
        .sort({ processed_at: -1 })
        .limit(limit)
        .toArray(),
      TelegramProvider.find().select('groupId groupName profileImage isActive').lean(),
    ]);

    const providerByGroupId = new Map(
      providers.map((p) => [String(p.groupId), p])
    );

    return NextResponse.json({
      success: true,
      logs: messages.map((m) => {
        const chatId = String(m.chat_id ?? '');
        const provider = providerByGroupId.get(chatId) ?? null;
        return {
          id: String(m._id),
          chatId,
          messageId: m.message_id ?? null,
          processedAt: m.processed_at ?? null,
          provider: provider
            ? {
                groupId: provider.groupId,
                groupName: provider.groupName,
                profileImage: provider.profileImage || null,
                isActive: provider.isActive,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error('Admin processed-logs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch processed logs' }, { status: 500 });
  }
}
