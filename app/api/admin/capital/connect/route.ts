import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import { requireAdmin } from '@/lib/auth-helper';
import { encrypt } from '@/lib/encryption';
import {
  authenticate,
  getAccounts,
  CapitalApiError,
} from '@/lib/capitalcom';
import type { IBrokerAccountInfo } from '@/models/Broker';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/capital/connect
 *
 * Saves the operator's OWN Capital.com credentials (encrypted at rest) and
 * verifies them by creating a real API session + fetching accounts.
 * Credentials are NEVER returned in any response.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    let body: {
      email?: string;
      apiKey?: string;
      apiPassword?: string;
      env?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const email = (body.email ?? '').trim().toLowerCase();
    const apiKey = (body.apiKey ?? '').trim();
    const apiPassword = body.apiPassword ?? '';
    const env = body.env === 'live' ? 'live' : 'demo';

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Valid account email is required' }, { status: 400 });
    }
    if (!apiKey || apiKey.length < 8) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!apiPassword || apiPassword.length < 4) {
      return NextResponse.json({ error: 'API-key password is required' }, { status: 400 });
    }

    await connectDB();

    // Persist encrypted credentials FIRST so authenticate() can read them.
    const broker = await Broker.findOneAndUpdate(
      { brokerName: 'capital.com' },
      {
        $set: {
          accountEmail: email,
          encryptedApiKey: encrypt(apiKey),
          encryptedApiPassword: encrypt(apiPassword),
          connectionStatus: 'not_connected',
          connectionError: null,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Verify credentials with a real session on the SELECTED environment.
    try {
      await authenticate(env, broker);
    } catch (e) {
      const msg =
        e instanceof CapitalApiError ? e.message : 'Authentication failed';
      await Broker.updateOne(
        { _id: broker!._id },
        { $set: { connectionStatus: 'error', connectionError: msg } }
      );
      return NextResponse.json(
        { error: msg, connected: false },
        { status: 401 }
      );
    }

    // Fetch account snapshot for the dashboard (sanitized fields only).
    let accountInfo: IBrokerAccountInfo | undefined;
    try {
      const acc = await getAccounts(env);
      const preferred =
        acc.data?.accounts?.find((a) => a.preferred) ?? acc.data?.accounts?.[0];
      if (preferred) {
        accountInfo = {
          accountId: preferred.accountId,
          accountName: preferred.accountName,
          currency: acc.data?.currencyIsoCode,
          balance: preferred.balance?.balance,
          available: preferred.balance?.available,
          equity: preferred.balance?.balance,
          profitLoss: preferred.balance?.profitLoss,
          accountType: acc.data?.accountType,
        };
      }
    } catch {
      // Session works but account fetch failed — still report connected.
    }

    const updated = await Broker.findByIdAndUpdate(
      broker!._id,
      {
        $set: {
          environment: env,
          connectionStatus: 'connected',
          connectionError: null,
          accountInfo: accountInfo ?? null,
          lastConnectedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      success: true,
      connected: true,
      environment: updated!.environment,
      account: accountInfo ?? null,
      email: updated!.accountEmail,
    });
  } catch (error) {
    console.error('Capital connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect broker account' },
      { status: 500 }
    );
  }
}
