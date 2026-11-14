import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import { getCurrentUser } from '@/lib/auth-helper';
import { recordNotification } from '@/lib/notifications';

/**
 * POST /api/user/capital/disconnect
 * Removes the authenticated user's stored credentials and session tokens.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    await Broker.deleteOne({ userId: user._id, brokerName: 'capital.com' });

    void recordNotification({
      userId: user._id,
      actor: 'user',
      type: 'broker.disconnected',
      category: 'broker',
      title: 'Broker disconnected',
      message: `${user.userName} disconnected their Capital.com broker account.`,
      metadata: { broker: 'capital.com' },
      source: 'api/user/capital/disconnect',
    });

    return NextResponse.json({ success: true, connected: false });
  } catch (error) {
    console.error('Capital disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect broker' },
      { status: 500 }
    );
  }
}
