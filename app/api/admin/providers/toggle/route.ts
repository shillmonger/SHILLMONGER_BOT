import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TelegramProvider from '@/models/TelegramProvider';
import { getCurrentUser } from '@/lib/auth-helper';
import { recordNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();
    const body = await request.json();
    const { groupId } = body;

    // Normalize to string
    const normalizedGroupId = String(groupId);

    console.log('Toggling provider with groupId:', normalizedGroupId, 'Type:', typeof normalizedGroupId);

    const provider = await TelegramProvider.findOne({ groupId: normalizedGroupId });
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    provider.isActive = !provider.isActive;
    await provider.save();

    void recordNotification({
      actor: 'admin',
      actorId: user._id,
      type: provider.isActive ? 'admin.provider_enabled' : 'admin.provider_disabled',
      category: 'admin',
      title: `Signal provider ${provider.isActive ? 'enabled' : 'disabled'}`,
      message: `Admin ${user.userName ?? user.email} ${provider.isActive ? 'enabled' : 'disabled'} Telegram provider "${provider.groupName}" (${normalizedGroupId}).`,
      metadata: { groupId: normalizedGroupId, groupName: provider.groupName, isActive: provider.isActive },
      source: 'api/admin/providers/toggle',
    });

    return NextResponse.json({
      success: true,
      isActive: provider.isActive,
      message: 'Provider status updated',
    });
  } catch (error) {
    console.error('Error toggling provider:', error);
    return NextResponse.json(
      { error: 'Failed to toggle provider' },
      { status: 500 }
    );
  }
}
