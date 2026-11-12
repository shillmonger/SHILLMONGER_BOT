import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Broker from '@/models/Broker';
import BotConfig from '@/models/BotConfig';
import { requireAdmin } from '@/lib/auth-helper';
import { getSession, CapitalApiError } from '@/lib/capitalcom';

/**
 * GET /api/admin/trading/environment
 * Returns the effective environment + whether a session is usable.
 */
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const [broker, bot] = await Promise.all([
      Broker.findOne({ brokerName: 'capital.com' }).lean(),
      BotConfig.findOne({}).lean(),
    ]);

    const env = (bot?.environment ?? broker?.environment ?? 'demo') as
      | 'demo'
      | 'live';

    return NextResponse.json({
      environment: env,
      brokerEnvironment: broker?.environment ?? null,
      connectionStatus: broker?.connectionStatus ?? 'not_connected',
      connected: broker?.connectionStatus === 'connected',
      botEnvironment: bot?.environment ?? null,
    });
  } catch (error) {
    console.error('Environment GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch environment' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/trading/environment
 * Body: { environment: 'demo' | 'live' }
 *
 * Persists the selection on BOTH the broker doc and bot config so the whole
 * app uses one environment. For 'live', verifies a live session can actually
 * be established before accepting — otherwise rejects with 409.
 */
export async function PUT(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    let body: { environment?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const env = body.environment;
    if (env !== 'demo' && env !== 'live') {
      return NextResponse.json(
        { error: "environment must be 'demo' or 'live'" },
        { status: 400 }
      );
    }

    await connectDB();
    const broker = await Broker.findOne({ brokerName: 'capital.com' });
    if (!broker || broker.connectionStatus !== 'connected') {
      return NextResponse.json(
        { error: 'Broker account is not connected', connected: false },
        { status: 409 }
      );
    }

    // Verify a session can be established in the TARGET environment.
    // Demo and live sessions are fully independent — never mixed.
    try {
      await getSession(env);
    } catch (e) {
      const msg =
        e instanceof CapitalApiError ? e.message : 'Session check failed';
      return NextResponse.json(
        {
          error:
            env === 'live'
              ? `Live environment is not authorized: ${msg}`
              : `Demo environment unavailable: ${msg}`,
          environment: broker.environment,
        },
        { status: 409 }
      );
    }

    await Broker.updateOne({ _id: broker._id }, { $set: { environment: env } });
    await BotConfig.findOneAndUpdate(
      {},
      {
        $set: { environment: env },
        $setOnInsert: {
          userId: (guard as { _id: unknown })._id,
          maxOpenPositions: 0,
          riskPercentage: 0,
          maxDailyLoss: 0,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, environment: env });
  } catch (error) {
    console.error('Environment PUT error:', error);
    return NextResponse.json({ error: 'Failed to update environment' }, { status: 500 });
  }
}
