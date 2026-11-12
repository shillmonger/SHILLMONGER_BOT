import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helper';
import { getPositions, CapitalApiError } from '@/lib/capitalcom';
import BotConfig from '@/models/BotConfig';
import connectDB from '@/lib/db';

/**
 * GET /api/admin/trading/positions
 * Real open positions from Capital.com, mapped to the frontend shape.
 */
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const bot = await BotConfig.findOne({}).lean();
    const env = (bot?.environment ?? 'demo') as 'demo' | 'live';

    const res = await getPositions(env);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Capital.com positions request failed (HTTP ${res.status})`, positions: [] },
        { status: res.status === 0 ? 504 : 502 }
      );
    }

    const positions = (res.data?.positions ?? []).map((entry) => {
      const p = entry.position ?? {};
      const m = entry.market ?? {};
      const isBuy = String(p.direction).toUpperCase() === 'BUY';
      const current = isBuy ? (m.offer ?? m.bid ?? p.level) : (m.bid ?? m.offer ?? p.level);
      return {
        id: p.dealId ?? p.dealReference ?? 'unknown',
        symbol: m.instrumentName || m.epic || 'Unknown',
        epic: m.epic ?? null,
        dir: isBuy ? 'BUY' : 'SELL',
        entry: p.level ?? null,
        current: current ?? null,
        size: p.size ?? null,
        sl: p.stopLevel ?? null,
        tp: null, // Capital.com open-position payload does not expose TP level
        pl: p.upl ?? p.profitLoss ?? null,
        currency: p.currency ?? null,
        openedAt: p.createdDate ?? null,
        status: 'OPEN',
      };
    });

    return NextResponse.json({ environment: env, source: 'broker', positions });
  } catch (error) {
    if (error instanceof CapitalApiError) {
      return NextResponse.json({ error: error.message, positions: [] }, { status: error.status });
    }
    console.error('Positions error:', error);
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
  }
}
