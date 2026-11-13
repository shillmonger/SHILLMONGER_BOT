import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import SignalEvaluation from '@/models/SignalEvaluation';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/signal-evaluations?eligible=true&environment=demo&limit=500
 *
 * Per-signal, per-user eligibility audit trail written by the trading
 * engine — one document per (signal, user) describing whether the user
 * passed every gate or which stage rejected them. Each row is populated
 * with the evaluated user's profile (userName, email, avatar).
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '500', 10) || 500, 1), 2000);
    const eligibleParam = searchParams.get('eligible');
    const environment = searchParams.get('environment');

    const query: Record<string, unknown> = {};
    if (eligibleParam === 'true' || eligibleParam === 'false') {
      query.eligible = eligibleParam === 'true';
    }
    if (environment === 'demo' || environment === 'live') {
      query.environment = environment;
    }

    const evaluations = await SignalEvaluation.find(query)
      .sort({ evaluatedAt: -1, createdAt: -1 })
      .limit(limit)
      .populate('userId', 'userName email avatar')
      .lean();

    return NextResponse.json({
      success: true,
      evaluations: evaluations.map((e) => {
        const user = e.userId as unknown as { _id?: unknown; userName?: string; email?: string; avatar?: string } | null;
        return {
          id: String(e._id),
          signalChatId: e.signalChatId ?? null,
          signalMessageId: e.signalMessageId ?? null,
          signalRefId: e.signalRefId ?? null,
          userId: user?._id ? String(user._id) : e.userId ? String(e.userId) : null,
          userName: user?.userName ?? null,
          userEmail: user?.email ?? null,
          userAvatar: user?.avatar ?? null,
          environment: e.environment ?? null,
          symbol: e.symbol ?? null,
          direction: e.direction ?? null,
          groupName: e.groupName ?? null,
          orderType: e.orderType ?? null,
          eligible: e.eligible ?? false,
          stage: e.stage ?? null,
          reason: e.reason ?? null,
          executionId: e.executionId ? String(e.executionId) : null,
          evaluatedAt: e.evaluatedAt ?? null,
        };
      }),
    });
  } catch (error) {
    console.error('Admin signal-evaluations GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch signal evaluations' }, { status: 500 });
  }
}
