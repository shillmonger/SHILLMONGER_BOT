import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BotConfig from '@/models/BotConfig';
import { getCurrentUser } from '@/lib/auth-helper';
import { getHistoryActivity, CapitalApiError } from '@/lib/capitalcom';

/**
 * GET /api/user/trading/analytics?days=90
 * Aggregates the authenticated user's broker activity into daily net P/L and
 * win rate. Only broker-sourced data — no simulated figures.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    const userId = String(user._id);
    const bot = await BotConfig.findOne({ userId }).lean();
    const env = (bot?.environment ?? 'demo') as 'demo' | 'live';

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(Number(searchParams.get('days') ?? 90) || 90, 1), 90);

    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);

    const res = await getHistoryActivity(
      userId,
      { from: from.toISOString(), to: to.toISOString() },
      env
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `Capital.com history request failed (HTTP ${res.status})`, daily: [] },
        { status: res.status === 0 ? 504 : 502 }
      );
    }

    // Bucket realized P/L by UTC day. Capital.com activity entries expose a
    // profit/profitLoss field on closed-position activities.
    const dailyMap = new Map<string, number>();
    let wins = 0;
    let losses = 0;

    for (const entry of res.data?.activities ?? []) {
      const a = (entry as { activity?: Record<string, unknown> }).activity ??
        (entry as Record<string, unknown>);
      const profit = a.profit ?? a.profitLoss;
      if (typeof profit !== 'number') continue;

      const rawDate = (a.closedDate ?? a.createdDateUTC ?? a.createdDate) as string | undefined;
      const day = rawDate ? rawDate.slice(0, 10) : toISOStringDay(new Date());
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + profit);
      if (profit > 0) wins += 1;
      else if (profit < 0) losses += 1;
    }

    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

    return NextResponse.json({
      environment: env,
      source: 'broker',
      days,
      daily,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
      wins,
      losses,
    });
  } catch (error) {
    if (error instanceof CapitalApiError) {
      return NextResponse.json({ error: error.message, daily: [] }, { status: error.status });
    }
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}

function toISOStringDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
