import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TradeExecution from '@/models/TradeExecution';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/trading/executions?status=open&limit=100
 * Local audit trail of order submissions/confirms for the personal bot.
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 500);

    const query: Record<string, unknown> = {};
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
