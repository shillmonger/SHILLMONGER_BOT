import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { botFetch } from '@/lib/bot';

/**
 * GET /api/admin/telegram/groups
 * Proxies the Python bot's GET /api/telegram/groups (Bearer ADMIN_API_KEY).
 * Returns the Telegram groups/channels visible to the bot account.
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

    const result = await botFetch('/api/telegram/groups', { key: 'admin' });
    return NextResponse.json(result.data, { status: result.ok ? 200 : result.status });
  } catch (error) {
    console.error('Error fetching Telegram groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Telegram groups from bot service' },
      { status: 500 }
    );
  }
}
