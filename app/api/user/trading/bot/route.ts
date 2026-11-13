import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BotConfig from '@/models/BotConfig';
import { getCurrentUser } from '@/lib/auth-helper';

const VALID_STATES = ['stopped', 'running', 'paused'] as const;

/** Per-user guard: returns the authenticated user or a NextResponse. */
async function guardUser() {
  const { NextResponse } = await import('next/server');
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return user;
}

/** Sanitize a bot config doc for API responses (no secrets exist here anyway). */
function sanitize(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const { _id, createdAt, updatedAt, ...rest } = doc as Record<string, unknown> & {
    _id: unknown; createdAt: Date; updatedAt: Date;
  };
  delete rest.userId;
  return { ...rest, id: String(_id), updatedAt, createdAt };
}

/** GET /api/user/trading/bot — current user's bot configuration. */
export async function GET() {
  try {
    const user = await guardUser();
    if (user instanceof Response) return user;

    await connectDB();
    const bot = await BotConfig.findOne({ userId: user._id }).lean();
    return NextResponse.json({ bot: sanitize(bot as Record<string, unknown> | null) });
  } catch (error) {
    console.error('Bot GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch bot config' }, { status: 500 });
  }
}

/**
 * PUT /api/user/trading/bot
 * Body (all optional): {
 *   state?: 'stopped'|'running'|'paused',
 *   environment?: 'demo'|'live',
 *   automationEnabled?: boolean,
 *   emergencyStop?: boolean,
 *   maxOpenPositions?: number,
 *   riskPercentage?: number,
 *   maxDailyLoss?: number,
 *   allowedInstruments?: string[],
 *   strategy?: string
 * }
 *
 * These are PREFERENCES. 'running' does not prove a worker exists — the
 * trading engine checks broker connectivity independently before any order.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await guardUser();
    if (user instanceof Response) return user;
    const userId = String(user._id);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};

    if (body.state !== undefined) {
      if (!VALID_STATES.includes(body.state as (typeof VALID_STATES)[number])) {
        return NextResponse.json(
          { error: `state must be one of: ${VALID_STATES.join(', ')}` },
          { status: 400 }
        );
      }
      update.state = body.state;
    }
    if (body.environment !== undefined) {
      if (body.environment !== 'demo' && body.environment !== 'live') {
        return NextResponse.json(
          { error: "environment must be 'demo' or 'live'" },
          { status: 400 }
        );
      }
      update.environment = body.environment;
    }
    if (body.automationEnabled !== undefined) {
      if (typeof body.automationEnabled !== 'boolean') {
        return NextResponse.json({ error: 'automationEnabled must be boolean' }, { status: 400 });
      }
      update.automationEnabled = body.automationEnabled;
    }
    if (body.emergencyStop !== undefined) {
      if (typeof body.emergencyStop !== 'boolean') {
        return NextResponse.json({ error: 'emergencyStop must be boolean' }, { status: 400 });
      }
      update.emergencyStop = body.emergencyStop;
    }
    if (body.maxOpenPositions !== undefined) {
      const n = Number(body.maxOpenPositions);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: 'maxOpenPositions must be 0-100' }, { status: 400 });
      }
      update.maxOpenPositions = Math.floor(n);
    }
    if (body.riskPercentage !== undefined) {
      const n = Number(body.riskPercentage);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: 'riskPercentage must be 0-100' }, { status: 400 });
      }
      update.riskPercentage = n;
    }
    if (body.maxDailyLoss !== undefined) {
      const n = Number(body.maxDailyLoss);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'maxDailyLoss must be >= 0' }, { status: 400 });
      }
      update.maxDailyLoss = n;
    }
    if (body.allowedInstruments !== undefined) {
      if (!Array.isArray(body.allowedInstruments) || body.allowedInstruments.some((s) => typeof s !== 'string')) {
        return NextResponse.json({ error: 'allowedInstruments must be string[]' }, { status: 400 });
      }
      update.allowedInstruments = body.allowedInstruments.map((s) => s.trim().toUpperCase()).filter(Boolean);
    }
    if (body.strategy !== undefined) {
      if (typeof body.strategy !== 'string' || body.strategy.length > 100) {
        return NextResponse.json({ error: 'strategy must be a string (max 100 chars)' }, { status: 400 });
      }
      update.strategy = body.strategy;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await connectDB();
    const bot = await BotConfig.findOneAndUpdate(
      { userId },
      {
        $set: update,
        // Schema defaults already supply the 0 values on insert; only
        // userId must be set explicitly (never in $set — it's the filter).
        $setOnInsert: { userId },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      success: true,
      bot: sanitize(bot as unknown as Record<string, unknown> | null),
    });
  } catch (error) {
    console.error('Bot PUT error:', error);
    return NextResponse.json({ error: 'Failed to update bot config' }, { status: 500 });
  }
}
