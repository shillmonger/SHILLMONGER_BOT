import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import { getCurrentUser } from '@/lib/auth-helper';
import { getSession, getAccounts, CapitalApiError } from '@/lib/capitalcom';
import type { IBrokerAccountInfo } from '@/models/Broker';

/**
 * GET /api/user/capital/status
 * Returns the authenticated user's sanitized broker connection status —
 * NEVER credentials or tokens.
 *
 * When connected, refreshes the account snapshot live from Capital.com for
 * the broker's CURRENT environment so demo/live balances are never stale.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    const broker = await Broker.findOne({
      userId: user._id,
      brokerName: 'capital.com',
    });

    if (!broker) {
      return NextResponse.json({
        connected: false,
        status: 'not_connected',
        environment: 'demo',
      });
    }

    let account = broker.accountInfo ?? null;
    let liveOk = broker.connectionStatus === 'connected';

    // Refresh account snapshot from Capital.com for THIS user's current env.
    if (broker.connectionStatus === 'connected') {
      try {
        const userId = String(user._id);
        const env = broker.environment;
        await getSession(userId, env);
        const acc = await getAccounts(userId, env);
        const preferred =
          acc.data?.accounts?.find((a) => a.preferred) ?? acc.data?.accounts?.[0];
        if (preferred) {
          account = {
            accountId: preferred.accountId,
            accountName: preferred.accountName,
            currency: acc.data?.currencyIsoCode,
            balance: preferred.balance?.balance,
            available: preferred.balance?.available,
            equity: preferred.balance?.balance,
            profitLoss: preferred.balance?.profitLoss,
            accountType: acc.data?.accountType,
          } satisfies IBrokerAccountInfo;
          await Broker.updateOne({ _id: broker._id }, { $set: { accountInfo: account } });
        }
      } catch (e) {
        liveOk = false;
        console.error(
          '[capital/status] account refresh failed:',
          e instanceof CapitalApiError ? e.message : e
        );
      }
    }

    const lean = broker.toObject ? broker.toObject() : broker;
    return NextResponse.json({
      connected: liveOk,
      status: lean.connectionStatus,
      active: lean.status !== 'disabled',
      environment: lean.environment,
      email: lean.accountEmail,
      account,
      connectionError: lean.connectionError ?? null,
      lastConnectedAt: lean.lastConnectedAt ?? null,
      lastSessionRefreshAt: lean.lastSessionRefreshAt ?? null,
    });
  } catch (error) {
    console.error('Capital status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch broker status' },
      { status: 500 }
    );
  }
}
