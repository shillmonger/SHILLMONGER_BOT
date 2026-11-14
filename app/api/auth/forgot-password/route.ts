import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { generateResetToken } from '@/lib/auth';
import { sendEmail, getForgotPasswordEmail } from '@/lib/email';
import { getAppUrl } from '@/lib/config';
import { recordNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validation
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json(
        { message: 'If an account exists with this email, a password reset link has been sent' },
        { status: 200 }
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.json(
        { message: 'If an account exists with this email, a password reset link has been sent' },
        { status: 200 }
      );
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token expires in 1 hour

    // Update user with reset token
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Send reset email
    const appUrl = getAppUrl();
    const resetUrl = `${appUrl}/auth-page/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    const emailSent = await sendEmail(
      email,
      'Reset Your SHILLMONGER Password',
      getForgotPasswordEmail(user.userName, resetUrl)
    );

    if (!emailSent) {
      console.error('Failed to send reset email to:', email);
    }

    void recordNotification({
      userId: user._id,
      actor: 'user',
      type: 'user.password_reset_requested',
      category: 'auth',
      title: 'Password reset requested',
      message: `${user.userName} (${user.email}) requested a password reset link.`,
      metadata: { username: user.userName, email: user.email },
      source: 'api/auth/forgot-password',
    });

    return NextResponse.json(
      { message: 'If an account exists with this email, a password reset link has been sent' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}