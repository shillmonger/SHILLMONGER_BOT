import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * POST /api/admin/capital/disconnect
 * Removes stored credentials and session tokens for the personal broker.
 */
export async function POST() {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    await Broker.deleteOne({ brokerName: 'capital.com' });

    return NextResponse.json({ success: true, connected: false });
  } catch (error) {
    console.error('Capital disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect broker' },
      { status: 500 }
    );
  }
}
