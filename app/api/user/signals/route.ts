import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { botFetch } from '@/lib/bot';

/**
 * GET /api/user/signals
 * Proxies the Python bot's GET /api/user/signals (Bearer FRONTEND_API_KEY).
 * The Python API returns the shared signal feed — it does not filter per
 * user, so every authenticated user sees the same signals.
 * Forwards: limit, symbol, direction, status.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await botFetch('/api/user/signals', {
      key: 'frontend',
      query: {
        limit: searchParams.get('limit') || undefined,
        symbol: searchParams.get('symbol') || undefined,
        direction: searchParams.get('direction') || undefined,
        status: searchParams.get('status') || undefined,
      },
    });

    return NextResponse.json(result.data, { status: result.ok ? 200 : result.status });
  } catch (error) {
    console.error('User signals proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
