import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import BotConfig from '@/models/BotConfig';
import { requireAdmin } from '@/lib/auth-helper';
import { recordNotification } from '@/lib/notifications';

/**
 * PATCH /api/admin/brokers/[id]
 * Body: { status: 'active' | 'disabled' }
 * Enables/disables a user's broker — disabled brokers cannot execute trades.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    let body: { status?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (body.status !== 'active' && body.status !== 'disabled') {
      return NextResponse.json(
        { error: "status must be 'active' or 'disabled'" },
        { status: 400 }
      );
    }

    await connectDB();
    const broker = await Broker.findByIdAndUpdate(
      id,
      { $set: { status: body.status } },
      { returnDocument: 'after' }
    ).lean();

    if (!broker) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    void recordNotification({
      userId: broker.userId,
      actor: 'admin',
      actorId: guard._id,
      type: body.status === 'disabled' ? 'admin.broker_disabled' : 'admin.broker_enabled',
      category: 'admin',
      title: `Broker ${body.status === 'disabled' ? 'disabled' : 'enabled'} by admin`,
      message: `Admin ${guard.userName ?? guard.email} ${body.status === 'disabled' ? 'disabled' : 're-enabled'} broker ${broker.brokerName} for user ${String(broker.userId)}.`,
      metadata: { brokerId: id, brokerName: broker.brokerName, status: body.status },
      source: 'api/admin/brokers/[id]',
    });

    return NextResponse.json({ success: true, status: broker.status });
  } catch (error) {
    console.error('Admin broker PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update broker' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/brokers/[id]
 * Permanently deletes the broker document (credentials + encrypted session
 * tokens) AND that user's BOT_CONFIG document. Trade execution history is
 * preserved for audit.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    await connectDB();

    const broker = await Broker.findById(id).lean();
    if (!broker) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    const [brokerRes, botRes] = await Promise.all([
      Broker.deleteOne({ _id: broker._id }),
      BotConfig.deleteOne({ userId: broker.userId }),
    ]);

    void recordNotification({
      userId: broker.userId,
      actor: 'admin',
      actorId: guard._id,
      type: 'admin.broker_deleted',
      category: 'admin',
      title: 'Broker deleted by admin',
      message: `Admin ${guard.userName ?? guard.email} deleted broker ${broker.brokerName} and bot config for user ${String(broker.userId)}.`,
      metadata: {
        brokerId: id,
        brokerName: broker.brokerName,
        deleted: { broker: brokerRes.deletedCount > 0, botConfig: botRes.deletedCount > 0 },
      },
      source: 'api/admin/brokers/[id]',
    });

    return NextResponse.json({
      success: true,
      deleted: {
        broker: brokerRes.deletedCount > 0,
        botConfig: botRes.deletedCount > 0,
      },
    });
  } catch (error) {
    console.error('Admin broker DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete broker' }, { status: 500 });
  }
}
