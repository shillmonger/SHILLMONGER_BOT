import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BotConfig from '@/models/BotConfig';
import TradeExecution from '@/models/TradeExecution';
import { getCurrentUser } from '@/lib/auth-helper';

const OPEN_STATUSES = new Set(['open', 'submitted', 'pending']);

/**
 * GET /api/user/trading/analytics?days=90
 * Aggregates the authenticated user's TRADE_EXECUTIONS records into daily
 * net P/L and win rate:
 *   - closed trades contribute realizedPnl, bucketed by closedAt day
 *   - open trades contribute unrealizedPnl to today's bucket
 *   - wins/losses count closed trades only
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

    const from = new Date(Date.now() - days * 86400000);

    const executions = await TradeExecution.find({
      userId: user._id,
      environment: env,
      createdAt: { $gte: from },
    })
      .select('status realizedPnl unrealizedPnl closedAt updatedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const todayKey = dayKey(new Date());

    const dailyMap = new Map<string, number>();
    let wins = 0;
    let losses = 0;

    for (const e of executions) {
      if (e.status === 'closed') {
        if (typeof e.realizedPnl !== 'number') continue;
        const day = e.closedAt ? dayKey(new Date(e.closedAt)) : todayKey;
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + e.realizedPnl);
        if (e.realizedPnl > 0) wins += 1;
        else if (e.realizedPnl < 0) losses += 1;
      } else if (OPEN_STATUSES.has(e.status ?? '') && typeof e.unrealizedPnl === 'number') {
        dailyMap.set(todayKey, (dailyMap.get(todayKey) ?? 0) + e.unrealizedPnl);
      }
    }

    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

    return NextResponse.json({
      environment: env,
      source: 'trade_executions',
      days,
      daily,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
      wins,
      losses,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
