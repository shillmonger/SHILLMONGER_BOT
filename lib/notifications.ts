import connectDB from '@/lib/db';
import Notification, {
  type NotificationActor,
  type NotificationCategory,
} from '@/models/Notification';

export interface NotifyInput {
  /** User the event belongs to (omit/null for platform-level events). */
  userId?: string | { toString(): string } | null;
  actor?: NotificationActor;
  /** Admin/system actor's user id, when known. */
  actorId?: string | { toString(): string } | null;
  /** Stable event key, e.g. 'trade.closed', 'bot.state_changed'. */
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

/**
 * Append an entry to the NOTIFICATIONS collection. NEVER throws — a
 * notification failure must not break the action that triggered it.
 * Safe to call without awaiting (fire-and-forget).
 */
export async function recordNotification(input: NotifyInput): Promise<void> {
  try {
    await connectDB();
    await Notification.create({
      userId: input.userId ? String(input.userId) : undefined,
      actor: input.actor ?? 'system',
      actorId: input.actorId ? String(input.actorId) : undefined,
      type: input.type,
      category: input.category,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? undefined,
      source: input.source ?? undefined,
    });
  } catch (e) {
    console.error('[notifications] failed to record:', input.type, e);
  }
}
