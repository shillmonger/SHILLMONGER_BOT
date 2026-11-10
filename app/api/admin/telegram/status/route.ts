import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { botFetch } from '@/lib/bot';

/**
 * GET /api/admin/telegram/status
 * Proxies the Python bot's GET /api/telegram/status (Bearer FRONTEND_API_KEY
 * on the bot side). Returns the real listener state:
 * { connected, monitoring, connection_status, monitored_group_count, last_error }
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const result = await botFetch('/api/telegram/status', { key: 'frontend' });
    return NextResponse.json(result.data, { status: result.ok ? 200 : result.status });
  } catch (error) {
    console.error('Telegram status proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch Telegram status' }, { status: 500 });
  }
}
