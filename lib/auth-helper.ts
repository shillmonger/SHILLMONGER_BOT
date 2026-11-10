import { cookies } from 'next/headers';
import { verifyToken } from './auth';
import User from '@/models/User';
import connectDB from './db';

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    await connectDB();
    const user = await User.findById(decoded.userId).select('-passwordHash -verificationToken -resetToken -resetTokenExpiry');
    
    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Returns the authenticated user only when they have the admin role.
 * Returns null for anonymous users and non-admin users alike — callers
 * should map null to 401/403 as appropriate.
 */
export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return null;
  }
  return user;
}