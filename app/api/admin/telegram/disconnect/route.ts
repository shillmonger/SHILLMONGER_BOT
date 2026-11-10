import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { botFetch } from '@/lib/bot';

/**
 * POST /api/admin/telegram/disconnect
 * Proxies the Python bot's POST /api/telegram/disconnect (Bearer ADMIN_API_KEY).
 * Stops the Telethon listener; the Python API keeps running.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const result = await botFetch('/api/telegram/disconnect', {
      method: 'POST',
      key: 'admin',
    });
    return NextResponse.json(result.data, { status: result.ok ? 200 : result.status });
  } catch (error) {
    console.error('Telegram disconnect proxy error:', error);
    return NextResponse.json({ error: 'Failed to disconnect Telegram listener' }, { status: 500 });
  }
}
