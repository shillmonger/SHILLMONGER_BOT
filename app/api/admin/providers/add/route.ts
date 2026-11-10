import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TelegramProvider from '@/models/TelegramProvider';
import { getCurrentUser } from '@/lib/auth-helper';

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
    const { groupId, groupName, profileImage } = body;

    // Normalize groupId to string
    const normalizedGroupId = String(groupId);

    console.log('Adding provider with groupId:', normalizedGroupId, 'Type:', typeof normalizedGroupId);

    // Check if provider already exists
    const existing = await TelegramProvider.findOne({ groupId: normalizedGroupId });
    if (existing) {
      return NextResponse.json(
        { error: 'Provider already exists' },
        { status: 400 }
      );
    }

    const provider = await TelegramProvider.create({
      groupId: normalizedGroupId,
      groupName,
      profileImage: profileImage || '',
    });

    return NextResponse.json({
      success: true,
      providerId: provider._id,
      message: 'Provider added successfully',
    });
  } catch (error) {
    console.error('Error adding provider:', error);
    return NextResponse.json(
      { error: 'Failed to add provider' },
      { status: 500 }
    );
  }
}
