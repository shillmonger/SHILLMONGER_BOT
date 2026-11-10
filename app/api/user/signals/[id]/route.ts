import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { botFetch } from '@/lib/bot';

/**
 * GET /api/user/signals/[id]
 * Proxies the Python bot's GET /api/user/signals/{signal_id}
 * (Bearer FRONTEND_API_KEY).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const result = await botFetch(`/api/user/signals/${encodeURIComponent(id)}`, {
      key: 'frontend',
    });

    return NextResponse.json(result.data, { status: result.ok ? 200 : result.status });
  } catch (error) {
    console.error('User signal proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch signal' }, { status: 500 });
  }
}
