import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationActor = 'user' | 'admin' | 'system';
export type NotificationCategory =
  | 'auth'
  | 'account'
  | 'trading'
  | 'broker'
  | 'admin'
  | 'system';

/**
 * Site-wide activity feed. Every meaningful user/admin/system action is
 * appended here so the admin dashboard can audit what happened on the
 * platform: registrations, logins, bot state changes, environment
 * switches, trade opens/closes, broker connections, admin interventions.
 */
export interface INotification extends Document {
  /** User the event belongs to. Null for platform-level events. */
  userId?: mongoose.Types.ObjectId | null;
  /** Who performed the action. */
  actor: NotificationActor;
  /** For admin/system actors: the admin user's id, when known. */
  actorId?: mongoose.Types.ObjectId | null;
  /** Stable machine-readable event key, e.g. 'trade.closed', 'bot.state_changed'. */
  type: string;
  category: NotificationCategory;
  /** Short headline, e.g. "Trade closed". */
  title: string;
  /** Human-readable description with the important details inline. */
  message: string;
  /** Structured extras: old/new values, symbol, pnl, broker name, etc. */
  metadata?: Record<string, unknown>;
  /** Module/route that emitted the event (e.g. 'api/user/trading/bot'). */
  source?: string;
  /** Delivery/read status: 'unseen' until the user marks it seen. */
  status: 'unseen' | 'seen';
  /** Set when the user marks the notification as seen; null = unseen. */
  seenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actor: {
      type: String,
      enum: ['user', 'admin', 'system'],
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['auth', 'account', 'trading', 'broker', 'admin', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    source: { type: String, default: null },
    status: {
      type: String,
      enum: ['unseen', 'seen'],
      default: 'unseen',
    },
    seenAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'NOTIFICATIONS',
  }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ category: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
