import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { normalizePfpPath } from '@/lib/pfp';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        userName: user.userName,
        email: user.email,
        avatar: normalizePfpPath(user.avatar),
        emailVerified: user.emailVerified,
        role: user.role,
        status: user.status,
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}