import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Notification from '@/models/Notification';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/notifications
 * Query params:
 *   limit     — max rows (default 200, cap 1000)
 *   category  — auth | account | trading | broker | admin | system
 *   type      — exact event type, e.g. 'trade.closed'
 *   actor     — user | admin | system
 *   userId    — scope to one user
 *   user      — substring search on the subject user's username/email
 *   q         — substring search on title/message/type
 *   before    — ISO date cursor (return events older than this)
 *   unseen    — '1' to return only notifications not yet seen
 *
 * Returns notifications newest-first, joined with the subject user's
 * profile (avatar, username, email) and the acting admin's profile.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '200', 10) || 200, 1), 1000);
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const actor = searchParams.get('actor');
    const userId = searchParams.get('userId');
    const userQuery = searchParams.get('user')?.trim();
    const q = searchParams.get('q')?.trim();
    const before = searchParams.get('before');
    const unseenOnly = searchParams.get('unseen') === '1';

    const filter: Record<string, unknown> = {};
    if (category && ['auth', 'account', 'trading', 'broker', 'admin', 'system'].includes(category)) {
      filter.category = category;
    }
    if (type) filter.type = type;
    if (actor && ['user', 'admin', 'system'].includes(actor)) filter.actor = actor;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    } else if (userQuery) {
      // Resolve matching users first, then scope notifications to them.
      const rx = new RegExp(userQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matches = await User.find({
        $or: [{ userName: rx }, { email: rx }],
      })
        .select('_id')
        .limit(500)
        .lean();
      const ids = matches.map((u) => u._id);
      if (ids.length === 0) {
        return NextResponse.json({ success: true, total: 0, notifications: [] });
      }
      filter.userId = { $in: ids };
    }
    if (before) {
      const d = new Date(before);
      if (!Number.isNaN(d.getTime())) filter.createdAt = { $lt: d };
    }
    // $and keeps the unseen and text-search clauses independent of each other.
    const andClauses: Record<string, unknown>[] = [];
    if (unseenOnly) {
      andClauses.push({
        $or: [{ status: 'unseen' }, { status: { $ne: 'seen' }, seenAt: null }],
      });
    }
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andClauses.push({ $or: [{ title: rx }, { message: rx }, { type: rx }] });
    }
    if (andClauses.length) filter.$and = andClauses;

    const [docs, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    // Join subject users + acting admins in one lookup.
    const ids = new Set<string>();
    for (const d of docs) {
      if (d.userId) ids.add(String(d.userId));
      if (d.actorId) ids.add(String(d.actorId));
    }
    const users = ids.size
      ? await User.find({ _id: { $in: [...ids].map((i) => new mongoose.Types.ObjectId(i)) } })
          .select('userName email avatar role')
          .lean()
      : [];
    const userById = new Map(users.map((u) => [String(u._id), u]));

    return NextResponse.json({
      success: true,
      total,
      notifications: docs.map((d) => {
        const subject = d.userId ? userById.get(String(d.userId)) : null;
        const actorUser = d.actorId ? userById.get(String(d.actorId)) : null;
        return {
          id: String(d._id),
          createdAt: d.createdAt,
          actor: d.actor,
          actorId: d.actorId ? String(d.actorId) : null,
          actorName: actorUser?.userName ?? actorUser?.email ?? null,
          actorUser: actorUser
            ? {
                id: String(actorUser._id),
                userName: actorUser.userName,
                email: actorUser.email,
                avatar: actorUser.avatar ?? null,
                role: actorUser.role,
              }
            : null,
          type: d.type,
          category: d.category,
          title: d.title,
          message: d.message,
          metadata: d.metadata ?? null,
          source: d.source ?? null,
          seen: d.status ? d.status === 'seen' : d.seenAt != null,
          status: d.status ?? (d.seenAt ? 'seen' : 'unseen'),
          seenAt: d.seenAt ?? null,
          user: subject
            ? {
                id: String(subject._id),
                userName: subject.userName,
                email: subject.email,
                avatar: subject.avatar ?? null,
                role: subject.role,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error('Admin notifications GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
