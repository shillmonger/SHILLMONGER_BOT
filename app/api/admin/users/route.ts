import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/users
 * Lists all users for the admin panel. Sensitive fields
 * (passwordHash, tokens) are never returned.
 */
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const users = await User.find()
      .select('userName email avatar role status phone country lastLoginAt createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: String(u._id),
        userName: u.userName,
        email: u.email,
        avatar: u.avatar ?? null,
        role: u.role,
        status: u.status,
        phone: u.phone ?? null,
        country: u.country ?? null,
        lastLoginAt: u.lastLoginAt ?? null,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error('Admin users GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
