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

    const pairKey = (chatId: unknown, messageId: unknown) => {
      const chat = Number(chatId);
      const message = Number(messageId);
      if (!Number.isInteger(chat) || !Number.isInteger(message)) return null;
      return `${chat}:${message}`;
    };

    const pairFilters: { chat_id: number; message_id: number }[] = [];
    const seenPairs = new Set<string>();
    for (const message of messages) {
      const chatId = Number(message.chat_id);
      const messageId = Number(message.message_id);
      if (!Number.isInteger(chatId) || !Number.isInteger(messageId)) continue;
      const key = `${chatId}:${messageId}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      pairFilters.push({ chat_id: chatId, message_id: messageId });
    }

    const [signals, pendingSignals] = pairFilters.length
      ? await Promise.all([
          db
            .collection('signals')
            .find({ $or: pairFilters }, { projection: { chat_id: 1, message_id: 1, status: 1 } })
            .toArray(),
          db
            .collection('pending_signals')
            .find({ $or: pairFilters }, { projection: { chat_id: 1, message_id: 1 } })
            .toArray(),
        ])
      : [[], []];

    const signalByPair = new Map(
      signals.map((signal) => [pairKey(signal.chat_id, signal.message_id), signal])
    );
    const pendingByPair = new Set(
      pendingSignals
        .map((signal) => pairKey(signal.chat_id, signal.message_id))
        .filter((key): key is string => key !== null)
    );

    const providerByGroupId = new Map(
      providers.map((p) => [String(p.groupId), p])
    );

    return NextResponse.json({
      success: true,
      logs: messages.map((m) => {
        const chatId = String(m.chat_id ?? '');
        const provider = providerByGroupId.get(chatId) ?? null;
        const key = pairKey(m.chat_id, m.message_id);
        const signal = key ? signalByPair.get(key) : undefined;
        const signalStatus = signal
          ? String(signal.status ?? 'RECEIVED').toUpperCase() || 'RECEIVED'
          : key && pendingByPair.has(key)
            ? 'PENDING'
            : 'NO SIGNAL';
        return {
          id: String(m._id),
          chatId,
          messageId: m.message_id ?? null,
          processedAt: m.processed_at ?? null,
          signalStatus,
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
