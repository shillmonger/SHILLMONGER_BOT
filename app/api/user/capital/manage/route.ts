import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import BotConfig from '@/models/BotConfig';
import { getCurrentUser } from '@/lib/auth-helper';

/**
 * PUT /api/user/capital/manage
 * Body: { active: boolean }
 * Toggles the user's broker activation. 'disabled' blocks all bot order
 * execution server-side (checked in the trading engine).
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let body: { active?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'active must be a boolean' }, { status: 400 });
    }

    await connectDB();
    const broker = await Broker.findOneAndUpdate(
      { userId: user._id, brokerName: 'capital.com' },
      { $set: { status: body.active ? 'active' : 'disabled' } },
      { returnDocument: 'after' }
    ).lean();

    if (!broker) {
      return NextResponse.json({ error: 'No broker connection found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, active: broker.status === 'active' });
  } catch (error) {
    console.error('Broker manage PUT error:', error);
    return NextResponse.json({ error: 'Failed to update broker status' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/capital/manage
 * Permanently deletes the authenticated user's BROKER document (credentials,
 * encrypted session tokens, account snapshot) AND their BOT_CONFIG document.
 * Trade execution history is preserved for audit.
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    const [brokerRes, botRes] = await Promise.all([
      Broker.deleteOne({ userId: user._id, brokerName: 'capital.com' }),
      BotConfig.deleteOne({ userId: user._id }),
    ]);

    return NextResponse.json({
      success: true,
      deleted: {
        broker: brokerRes.deletedCount > 0,
        botConfig: botRes.deletedCount > 0,
      },
    });
  } catch (error) {
    console.error('Broker manage DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete broker data' }, { status: 500 });
  }
}
