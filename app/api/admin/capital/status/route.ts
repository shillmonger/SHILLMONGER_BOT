import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/capital/status
 * Returns sanitized broker connection status — NEVER credentials or tokens.
 */
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const broker = await Broker.findOne({ brokerName: 'capital.com' }).lean();

    if (!broker) {
      return NextResponse.json({
        connected: false,
        status: 'not_connected',
        environment: 'demo',
      });
    }

    return NextResponse.json({
      connected: broker.connectionStatus === 'connected',
      status: broker.connectionStatus,
      environment: broker.environment,
      email: broker.accountEmail,
      account: broker.accountInfo ?? null,
      connectionError: broker.connectionError ?? null,
      lastConnectedAt: broker.lastConnectedAt ?? null,
      lastSessionRefreshAt: broker.lastSessionRefreshAt ?? null,
    });
  } catch (error) {
    console.error('Capital status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch broker status' },
      { status: 500 }
    );
  }
}
