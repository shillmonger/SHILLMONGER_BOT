import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import TPMatrix from '@/models/TPMatrix';
import User from '@/models/User';
import { recordNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
      email: string;
    };

    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }

    // Check if user is admin
    const user = await User.findById(decoded.userId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all TP matrix rules
    const tpMatrix = await TPMatrix.find()
      .sort({ min_balance: 1 })
      .exec();

    return NextResponse.json(
      { tpMatrix },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get TP matrix error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
      email: string;
    };

    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }

    // Check if user is admin
    const user = await User.findById(decoded.userId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { min_balance, max_balance, tp_level } = body;

    // Validate input
    if (!min_balance || !max_balance || !tp_level) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (min_balance >= max_balance) {
      return NextResponse.json(
        { error: 'Minimum balance must be less than maximum balance' },
        { status: 400 }
      );
    }

    if (tp_level < 1 || !Number.isInteger(tp_level)) {
      return NextResponse.json(
        { error: 'TP level must be a whole number of at least 1' },
        { status: 400 }
      );
    }

    // Check for overlapping ranges
    const overlappingRule = await TPMatrix.findOne({
      $or: [
        { min_balance: { $lte: max_balance }, max_balance: { $gte: min_balance } }
      ]
    });

    if (overlappingRule) {
      return NextResponse.json(
        { error: 'Balance range overlaps with existing rule' },
        { status: 400 }
      );
    }

    // Create new TP matrix rule
    const newRule = await TPMatrix.create({
      min_balance,
      max_balance,
      tp_level,
      active: true,
    });

    void recordNotification({
      actor: 'admin',
      actorId: decoded.userId,
      type: 'admin.tp_matrix_created',
      category: 'admin',
      title: 'TP matrix rule created',
      message: `Admin created a TP matrix rule: balance ${min_balance}-${max_balance} → TP level ${tp_level}.`,
      metadata: { ruleId: String(newRule._id), min_balance, max_balance, tp_level },
      source: 'api/admin/tp-matrix',
    });

    return NextResponse.json(
      { message: 'TP matrix rule created successfully', rule: newRule },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create TP matrix error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
