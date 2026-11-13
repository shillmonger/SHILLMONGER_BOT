import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/brokers
 * Lists every user's broker connection for the admin Broker Control page.
 * Sanitized — encrypted credentials and session tokens are NEVER returned.
 */
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const brokers = await Broker.find({})
      .populate('userId', 'userName username email avatar')
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      brokers: brokers.map((b) => ({
        id: String(b._id),
        userId: b.userId ? String((b.userId as { _id?: unknown })._id ?? b.userId) : null,
        user: b.userId
          ? {
              userName: (b.userId as { userName?: string }).userName,
              username: (b.userId as { username?: string }).username,
              email: (b.userId as { email?: string }).email,
              avatar: (b.userId as { avatar?: string }).avatar,
            }
          : null,
        brokerName: b.brokerName,
        accountEmail: b.accountEmail,
        environment: b.environment,
        connectionStatus: b.connectionStatus,
        status: b.status ?? 'active',
        connectionError: b.connectionError ?? null,
        account: b.accountInfo ?? null,
        lastConnectedAt: b.lastConnectedAt ?? null,
        lastSessionRefreshAt: b.lastSessionRefreshAt ?? null,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Admin brokers list error:', error);
    return NextResponse.json({ error: 'Failed to fetch brokers' }, { status: 500 });
  }
}
