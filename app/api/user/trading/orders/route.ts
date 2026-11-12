import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BotConfig from '@/models/BotConfig';
import { getCurrentUser } from '@/lib/auth-helper';
import { getOrders } from '@/lib/capitalcom';

/**
 * GET /api/user/trading/orders
 * Pending/working orders from the authenticated user's Capital.com account.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    const userId = String(user._id);
    const bot = await BotConfig.findOne({ userId }).lean();
    const env = (bot?.environment ?? 'demo') as 'demo' | 'live';

    const res = await getOrders(userId, env);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Capital.com orders request failed (HTTP ${res.status})`, orders: [] },
        { status: res.status === 0 ? 504 : 502 }
      );
    }

    const orders = (res.data?.orders ?? []).map((o) => {
      const w = (o as { workingOrderData?: Record<string, unknown> }).workingOrderData ?? (o as Record<string, unknown>);
      return {
        id: (w.workingOrderId ?? w.id ?? null) as string | null,
        epic: (w.epic ?? null) as string | null,
        direction: (w.direction ?? null) as string | null,
        size: (w.size ?? null) as number | null,
        level: (w.level ?? null) as number | null,
        type: (w.type ?? null) as string | null,
        stopLevel: (w.stopLevel ?? null) as number | null,
        profitLevel: (w.profitLevel ?? null) as number | null,
        createdDate: (w.createdDate ?? null) as string | null,
      };
    });

    return NextResponse.json({ environment: env, source: 'broker', orders });
  } catch (error) {
    console.error('Orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
