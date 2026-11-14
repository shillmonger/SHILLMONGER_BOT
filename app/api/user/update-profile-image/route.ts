import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import User from '@/models/User';
import connectDB from '@/lib/db';
import { normalizePfpPath } from '@/lib/pfp';
import { recordNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { profileImage } = await request.json();

    // Validation
    if (!profileImage || typeof profileImage !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Profile image is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Update avatar
    const updatedUser = await User.findByIdAndUpdate(
      decoded.userId,
      { avatar: profileImage },
      { returnDocument: 'after' }
    ).select('-passwordHash -verificationToken -resetToken -resetTokenExpiry');

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    void recordNotification({
      userId: decoded.userId,
      actor: 'user',
      type: 'account.avatar_updated',
      category: 'account',
      title: 'Profile image updated',
      message: `${updatedUser.userName} changed their profile picture.`,
      metadata: { username: updatedUser.userName, email: updatedUser.email },
      source: 'api/user/update-profile-image',
    });

    return NextResponse.json({
      success: true,
      message: 'Profile image updated successfully',
      avatar: normalizePfpPath(updatedUser.avatar),
    });
  } catch (error) {
    console.error('Error updating profile image:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
