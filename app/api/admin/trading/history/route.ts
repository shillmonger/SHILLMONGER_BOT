import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BotConfig from '@/models/BotConfig';
import { requireAdmin } from '@/lib/auth-helper';
import { getHistoryActivity, getTransactions, CapitalApiError } from '@/lib/capitalcom';

/**
 * GET /api/admin/trading/history?days=30&includeTransactions=1
 * Closed trades / account activity + optional transactions from Capital.com.
 * `days` maps to a from/to window (Capital.com history endpoints accept
 * date filters; default window is the last `days` days).
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const bot = await BotConfig.findOne({}).lean();
    const env = (bot?.environment ?? 'demo') as 'demo' | 'live';

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(Number(searchParams.get('days') ?? 30) || 30, 1), 90);
    const includeTransactions = searchParams.get('includeTransactions') === '1';

    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    const fmt = (d: Date) => d.toISOString();

    const [activityRes, txRes] = await Promise.all([
      getHistoryActivity({ from: fmt(from), to: fmt(to) }, env),
      includeTransactions
        ? getTransactions({ from: fmt(from), to: fmt(to) }, env)
        : Promise.resolve(null),
    ]);

    if (!activityRes.ok) {
      return NextResponse.json(
        { error: `Capital.com history request failed (HTTP ${activityRes.status})`, trades: [] },
        { status: activityRes.status === 0 ? 504 : 502 }
      );
    }

    // Map activity entries tolerantly — Capital.com activity payloads vary
    // by activity type; keep raw fields and extract common ones.
    const trades = (activityRes.data?.activities ?? []).map((entry) => {
      const a = (entry as { activity?: Record<string, unknown> }).activity ??
        (entry as Record<string, unknown>);
      return {
        id: (a.dealId ?? a.id ?? a.transactionId ?? null) as string | null,
        epic: (a.epic ?? null) as string | null,
        symbol: (a.epic ?? null) as string | null,
        direction: (a.direction ?? null) as string | null,
        size: (a.size ?? null) as number | null,
        entry: (a.level ?? null) as number | null,
        exit: (a.closeLevel ?? a.level ?? null) as number | null,
        profit: (a.profit ?? a.profitLoss ?? null) as number | null,
        type: (a.type ?? null) as string | null,
        status: (a.status ?? null) as string | null,
        openedAt: (a.createdDate ?? a.createdDateUTC ?? null) as string | null,
        closedAt: (a.closedDate ?? a.createdDateUTC ?? null) as string | null,
        raw: a,
      };
    });

    return NextResponse.json({
      environment: env,
      source: 'broker',
      days,
      trades,
      transactions: txRes?.ok ? (txRes.data?.transactions ?? []) : [],
    });
  } catch (error) {
    if (error instanceof CapitalApiError) {
      return NextResponse.json({ error: error.message, trades: [] }, { status: error.status });
    }
    console.error('History error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
