import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { botFetch } from '@/lib/bot';

/**
 * GET /api/admin/signals
 * Proxies the Python bot's GET /api/admin/signals (Bearer ADMIN_API_KEY).
 * Forwards the filters the Python API actually supports:
 * limit, symbol, direction, status.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const result = await botFetch('/api/admin/signals', {
      key: 'admin',
      query: {
        limit: searchParams.get('limit') || undefined,
        symbol: searchParams.get('symbol') || undefined,
        direction: searchParams.get('direction') || undefined,
        status: searchParams.get('status') || undefined,
      },
    });

    return NextResponse.json(result.data, { status: result.ok ? 200 : result.status });
  } catch (error) {
    console.error('Admin signals proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
