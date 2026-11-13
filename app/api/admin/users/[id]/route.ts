import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Broker from '@/models/Broker';
import BotConfig from '@/models/BotConfig';
import TradeExecution from '@/models/TradeExecution';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * PATCH /api/admin/users/[id]
 * Body: { status?: 'active' | 'suspended' | 'inactive', role?: 'user' | 'admin' }
 * Admins cannot suspend/delete themselves or remove their own admin role.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    let body: { status?: string; role?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update: Record<string, string> = {};
    if (body.status !== undefined) {
      if (!['active', 'suspended', 'inactive'].includes(body.status)) {
        return NextResponse.json(
          { error: "status must be 'active', 'suspended' or 'inactive'" },
          { status: 400 }
        );
      }
      update.status = body.status;
    }
    if (body.role !== undefined) {
      if (!['user', 'admin'].includes(body.role)) {
        return NextResponse.json({ error: "role must be 'user' or 'admin'" }, { status: 400 });
      }
      update.role = body.role;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // Self-protection: cannot suspend yourself or remove your own admin role.
    if (String(guard._id) === id) {
      if (update.status && update.status !== 'active') {
        return NextResponse.json({ error: 'You cannot suspend your own account' }, { status: 400 });
      }
      if (update.role === 'user') {
        return NextResponse.json({ error: 'You cannot remove your own admin role' }, { status: 400 });
      }
    }

    await connectDB();
    const user = await User.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: 'after' }
    ).select('userName email role status').lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id,
        userName: user.userName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Admin user PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Permanently deletes the user plus their broker connection, bot config,
 * and trade execution records. Cannot delete your own account.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    if (String(guard._id) === id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(id).select('userName').lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = new mongoose.Types.ObjectId(id);
    const [userRes, brokerRes, botRes, execRes] = await Promise.all([
      User.deleteOne({ _id: userId }),
      Broker.deleteMany({ userId }),
      BotConfig.deleteMany({ userId }),
      TradeExecution.deleteMany({ userId }),
    ]);

    return NextResponse.json({
      success: true,
      deleted: {
        user: userRes.deletedCount > 0,
        brokers: brokerRes.deletedCount,
        botConfigs: botRes.deletedCount,
        executions: execRes.deletedCount,
      },
    });
  } catch (error) {
    console.error('Admin user DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
