import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import BotConfig from '@/models/BotConfig';
import { getCurrentUser } from '@/lib/auth-helper';
import { getAccounts, getPositions, getSession, CapitalApiError } from '@/lib/capitalcom';

/**
 * GET /api/user/trading/dashboard
 * Real Capital.com data for the authenticated user's selected environment.
 * Returns source:'broker' | 'stale_cache' | 'unavailable' — never fabricated
 * figures.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    const userId = String(user._id);
    const [broker, bot] = await Promise.all([
      Broker.findOne({ userId, brokerName: 'capital.com' }).lean(),
      BotConfig.findOne({ userId }).lean(),
    ]);

    const env = (bot?.environment ?? broker?.environment ?? 'demo') as 'demo' | 'live';

    if (!broker || broker.connectionStatus !== 'connected') {
      return NextResponse.json({
        environment: env,
        source: 'unavailable',
        reason: 'broker_not_connected',
        bot: bot ?? null,
      });
    }

    // Refresh account + positions live from Capital.com for THIS user.
    let account = broker.accountInfo ?? null;
    let positions: Awaited<ReturnType<typeof getPositions>>['data'] = null;
    let sessionOk = true;

    try {
      await getSession(userId, env);
      const [accRes, posRes] = await Promise.all([
        getAccounts(userId, env),
        getPositions(userId, env),
      ]);
      const preferred =
        accRes.data?.accounts?.find((a) => a.preferred) ?? accRes.data?.accounts?.[0];
      if (preferred) {
        account = {
          accountId: preferred.accountId,
          accountName: preferred.accountName,
          currency: accRes.data?.currencyIsoCode,
          balance: preferred.balance?.balance,
          available: preferred.balance?.available,
          equity: preferred.balance?.balance,
          profitLoss: preferred.balance?.profitLoss,
          accountType: accRes.data?.accountType,
        };
      }
      positions = posRes.data;
      // Cache fresh account snapshot on THIS user's broker doc.
      await Broker.updateOne({ _id: broker._id }, { $set: { accountInfo: account } });
    } catch (e) {
      sessionOk = false;
      console.error('[dashboard] broker fetch failed:', e instanceof CapitalApiError ? e.message : e);
    }

    const openPositions = positions?.positions ?? [];
    const openPnl = openPositions.reduce((sum, p) => {
      const v = p.position?.upl ?? p.position?.profitLoss;
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);

    return NextResponse.json({
      environment: env,
      source: sessionOk ? 'broker' : 'stale_cache',
      account,
      bot: bot ?? null,
      summary: {
        balance: account?.balance ?? null,
        available: account?.available ?? null,
        equity: account?.equity ?? null,
        currency: account?.currency ?? null,
        openPositionsCount: openPositions.length,
        openPnl,
        // Today's realized P/L requires history aggregation — see /analytics.
        todayPnl: null,
      },
    });
  } catch (error) {
    console.error('Trading dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
