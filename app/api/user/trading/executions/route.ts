import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TradeExecution from '@/models/TradeExecution';
import { getCurrentUser } from '@/lib/auth-helper';

/**
 * GET /api/user/trading/executions?status=open&limit=100
 * The authenticated user's own order submission/confirmation audit trail.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 500);

    const query: Record<string, unknown> = { userId: user._id };
    if (status) query.status = status;

    const executions = await TradeExecution.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      executions: executions.map((e) => ({
        ...e,
        _id: String(e._id),
        userId: e.userId ? String(e.userId) : null,
      })),
    });
  } catch (error) {
    console.error('Executions error:', error);
    return NextResponse.json({ error: 'Failed to fetch executions' }, { status: 500 });
  }
}
