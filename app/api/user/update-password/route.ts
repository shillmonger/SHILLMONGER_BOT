import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { comparePassword, hashPassword } from '@/lib/auth';
import User from '@/models/User';
import connectDB from '@/lib/db';
import { recordNotification } from '@/lib/notifications';

export async function PATCH(request: NextRequest) {
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

    const { currentPassword, newPassword } = await request.json();

    // Validation
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get fresh user with password hash
    const freshUser = await User.findById(decoded.userId);
    if (!freshUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, freshUser.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    freshUser.passwordHash = newPasswordHash;
    await freshUser.save();

    void recordNotification({
      userId: freshUser._id,
      actor: 'user',
      type: 'account.password_changed',
      category: 'account',
      title: 'Password changed',
      message: `${freshUser.userName} changed their account password.`,
      metadata: { username: freshUser.userName, email: freshUser.email },
      source: 'api/user/update-password',
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
