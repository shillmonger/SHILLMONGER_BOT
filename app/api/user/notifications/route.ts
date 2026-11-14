import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Notification from '@/models/Notification';
import { getCurrentUser } from '@/lib/auth-helper';

const MAX_LIMIT = 200;

/**
 * GET /api/user/notifications
 * Returns the authenticated user's notifications, newest first.
 * Query: ?limit= (default 100, cap 200) &unseen=1 (only unseen)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 1), MAX_LIMIT);
    const unseenOnly = searchParams.get('unseen') === '1';

    // Docs written before the status field existed have no `status` —
    // treat a missing status + null seenAt as unseen.
    const unseenFilter = {
      $or: [{ status: 'unseen' as const }, { status: { $exists: false }, seenAt: null }],
    };

    const filter: Record<string, unknown> = { userId: user._id };
    if (unseenOnly) Object.assign(filter, unseenFilter);

    const docs = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unseenCount = await Notification.countDocuments({
      userId: user._id,
      ...unseenFilter,
    });

    return NextResponse.json({
      success: true,
      unseenCount,
      notifications: docs.map((d) => ({
        id: String(d._id),
        type: d.type,
        category: d.category,
        actor: d.actor,
        title: d.title,
        message: d.message,
        metadata: d.metadata ?? null,
        source: d.source ?? null,
        seen: d.status ? d.status === 'seen' : d.seenAt != null,
        status: d.status ?? (d.seenAt ? 'seen' : 'unseen'),
        seenAt: d.seenAt ?? null,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    console.error('User notifications GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/notifications
 * Body: { id: string }        — mark one notification as seen
 *   or { all: true }          — mark all of the user's notifications as seen
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let body: { id?: string; all?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    await connectDB();
    const now = new Date();

    if (body.all === true) {
      await Notification.updateMany(
        {
          userId: user._id,
          $or: [{ status: 'unseen' }, { status: { $exists: false }, seenAt: null }],
        },
        { $set: { status: 'seen', seenAt: now } }
      );
      return NextResponse.json({ success: true, markedAll: true });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'id or all is required' }, { status: 400 });
    }

    const res = await Notification.updateOne(
      {
        _id: body.id,
        userId: user._id,
        $or: [{ status: 'unseen' }, { status: { $exists: false }, seenAt: null }],
      },
      { $set: { status: 'seen', seenAt: now } }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: body.id });
  } catch (error) {
    console.error('User notifications PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
