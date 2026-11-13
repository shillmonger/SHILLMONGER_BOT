/**
 * Signal-driven trade execution engine (multi-user Capital.com).
 *
 * Pipeline per eligible user for one ingested Telegram signal:
 *   bot running + automationEnabled + !emergencyStop
 *   -> user's broker connected -> instrument allowlist -> open-position
 *   limit -> session check -> risk sizing (bot risk% or admin lot-size
 *   rule) -> POST /positions (single attempt)
 *   -> GET /confirms/{dealReference} -> TradeExecution record.
 *
 * Hard rules:
 *   - A trade is 'open' ONLY after /confirms confirms it.
 *   - Order submission is never blindly retried; uncertain outcomes are
 *     reconciled via the deal reference.
 *   - One execution per (userId, chatId, messageId) — unique index.
 *   - One user's failure never blocks another user's execution.
 */

import connectDB from '@/lib/db';
import BotConfig, { IBotConfig } from '@/models/BotConfig';
import TradeExecution from '@/models/TradeExecution';
import PositionLimit from '@/models/PositionLimit';
import LotSizeManagement from '@/models/LotSizeManagement';
import StopLossManagement from '@/models/StopLossManagement';
import TPMatrix from '@/models/TPMatrix';
import {
  getBroker,
  getSession,
  getPositions,
  getMarket,
  resolveEpic,
  createPosition,
  confirmPosition,
  CapitalApiError,
} from '@/lib/capitalcom';

export interface IngestedSignal {
  chat_id: number;
  message_id: number;
  symbol: string;
  direction: string;
  entry: number;
  stop_loss: number;
  take_profits: number[];
  order_type?: string;
  group_name?: string;
}

const MAX_CONFIRM_ATTEMPTS = 5;
const CONFIRM_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ExecResult {
  executed: boolean;
  reason?: string;
  dealReference?: string;
}

/**
 * Fan-out entry point: find every user whose bot is armed and execute the
 * signal independently for each. Called (fire-and-forget) by the ingest
 * route after a signal is stored.
 */
export async function executeSignal(signal: IngestedSignal): Promise<void> {
  try {
    await connectDB();
    const bots = await BotConfig.find({
      state: 'running',
      automationEnabled: true,
      emergencyStop: { $ne: true },
    }).lean();

    if (bots.length === 0) return;

    // Independent per-user execution — settle all, never let one failure
    // reject the others.
    await Promise.allSettled(bots.map((bot) => executeForUser(signal, bot)));
  } catch (e) {
    console.error('[trading-engine] fan-out error:', e);
  }
}

async function executeForUser(
  signal: IngestedSignal,
  bot: IBotConfig
): Promise<ExecResult> {
  const userId = String(bot.userId);
  const env = bot.environment;

  try {
    /* ---- Broker must be connected for THIS user ---- */
    const broker = await getBroker(userId);
    if (!broker || broker.connectionStatus !== 'connected') {
      return { executed: false, reason: 'broker_not_connected' };
    }
    // Operator-disabled broker — never execute for this user.
    if (broker.status === 'disabled') {
      return { executed: false, reason: 'broker_disabled' };
    }

    /* ---- Instrument allowlist ---- */
    const symbol = (signal.symbol || '').toUpperCase();
    if (bot.allowedInstruments.length > 0) {
      const allowed = bot.allowedInstruments.map((s) => s.toUpperCase());
      const norm = symbol.replace(/[^A-Z0-9]/g, '');
      if (!allowed.some((a) => a === symbol || a === norm)) {
        return { executed: false, reason: 'instrument_not_allowed' };
      }
    }

    const direction = signal.direction.toUpperCase();
    if (direction !== 'BUY' && direction !== 'SELL') {
      return { executed: false, reason: 'invalid_direction' };
    }

    /* ---- Admin balance-tier rules (bot value 0 = defer to admin) ---- */
    const equity =
      broker.accountInfo?.equity ?? broker.accountInfo?.balance ?? 0;

    const balanceQuery = {
      active: true,
      min_balance: { $lte: equity },
      max_balance: { $gte: equity },
    };
    const [posRule, lotRule, slRule, tpRule] = await Promise.all([
      PositionLimit.findOne(balanceQuery).lean(),
      LotSizeManagement.findOne(balanceQuery).lean(),
      StopLossManagement.findOne(balanceQuery).lean(),
      TPMatrix.findOne(balanceQuery).lean(),
    ]);

    /* TP matrix picks which take-profit from the signal to use
     * (tp_level 1 = take_profits[0]). Falls back to TP1. */
    const tpIndex = tpRule ? tpRule.tp_level - 1 : 0;
    const tp1 =
      signal.take_profits?.[tpIndex] ?? signal.take_profits?.[0];

    const maxPositions =
      bot.maxOpenPositions > 0
        ? bot.maxOpenPositions
        : posRule?.max_positions ?? null;

    /* ---- Open-position limit ---- */
    try {
      const posRes = await getPositions(userId, env);
      const openCount = posRes.data?.positions?.length ?? 0;
      if (maxPositions !== null && openCount >= maxPositions) {
        return { executed: false, reason: 'max_open_positions' };
      }
    } catch {
      return { executed: false, reason: 'positions_unavailable' };
    }

    /* ---- Session check ---- */
    try {
      await getSession(userId, env);
    } catch (e) {
      const msg = e instanceof CapitalApiError ? e.message : 'session_failed';
      return { executed: false, reason: `session_error:${msg}` };
    }

    /* ---- Instrument resolution ---- */
    const epic = await resolveEpic(userId, signal.symbol, env);
    if (!epic) {
      return { executed: false, reason: 'instrument_not_found' };
    }

    /* ---- Instrument metadata + sizing ----
     * riskPercentage > 0  -> risk-based sizing
     * riskPercentage = 0  -> fixed size from LotSizeManagement rule */
    const marketRes = await getMarket(userId, epic, env);
    const market = marketRes.data?.marketDetails;
    const minSize = market?.minDealSize ?? 0;
    const maxSize = market?.maxDealSize ?? Number.MAX_SAFE_INTEGER;
    const increment = market?.dealSizeIncrement ?? minSize ?? 0.01;
    const contractSize = market?.contractSize ?? 1;

    const slDistance =
      slRule && slRule.stop_loss > 0
        ? Number(slRule.stop_loss)
        : Math.abs(signal.entry - signal.stop_loss);

    const riskAmount = (equity * bot.riskPercentage) / 100;
    let size = 0;
    if (bot.riskPercentage > 0) {
      if (slDistance > 0 && riskAmount > 0) {
        size = riskAmount / (slDistance * contractSize);
      }
    } else {
      if (!lotRule || !(lotRule.lot_size > 0)) {
        await recordExecution(userId, signal, {
          env, epic, direction: direction as 'BUY' | 'SELL',
          size: 0, status: 'rejected', error: 'no_lot_size_rule_for_balance',
        takeProfitLevel: tp1,
        });
        return { executed: false, reason: 'no_lot_size_rule' };
      }
      size = Number(lotRule.lot_size);
    }
    if (increment > 0 && bot.riskPercentage > 0) {
      size = Math.floor(size / increment) * increment;
    }
    size = Math.min(size, maxSize);

    if (size <= 0 || size < minSize) {
      await recordExecution(userId, signal, {
        env, epic, direction: direction as 'BUY' | 'SELL',
        size: 0, status: 'rejected',
        error: `size_below_minimum (computed=${size}, min=${minSize})`,
        takeProfitLevel: tp1,
      });
      return { executed: false, reason: 'size_below_minimum' };
    }

    // Effective stop level: admin SL distance overrides the signal SL.
    const stopLevel =
      slRule && slRule.stop_loss > 0
        ? direction === 'BUY'
          ? signal.entry - Number(slRule.stop_loss)
          : signal.entry + Number(slRule.stop_loss)
        : signal.stop_loss;

    /* ---- Submit order — exactly once ---- */
    const submit = await createPosition(userId, {
      epic,
      direction: direction as 'BUY' | 'SELL',
      size,
      stopLevel,
      profitLevel: tp1,
      guaranteedStop: false,
    }, env);

    if (!submit.ok || !submit.data?.dealReference) {
      await recordExecution(userId, signal, {
        env, epic, direction: direction as 'BUY' | 'SELL',
        size, stopLevel, status: 'failed',
        error: `submit_http_${submit.status}`,
        takeProfitLevel: tp1,
      });
      return { executed: false, reason: 'submit_failed' };
    }

    const dealReference = submit.data.dealReference;

    /* ---- Confirm via deal reference — never trust the 200 ---- */
    let confirmed = false;
    let dealId: string | undefined;
    for (let i = 0; i < MAX_CONFIRM_ATTEMPTS; i++) {
      await sleep(CONFIRM_DELAY_MS);
      const conf = await confirmPosition(userId, dealReference, env);
      const status = conf.data?.dealConfirmation?.dealStatus;
      const deals = conf.data?.dealConfirmation?.affectedDeals ?? [];
      if (status === 'ACCEPTED' || deals.length > 0) {
        confirmed = true;
        dealId = deals[0]?.dealId;
        break;
      }
      if (status === 'REJECTED' || status === 'FAILED') break;
    }

    await recordExecution(userId, signal, {
      env, epic, direction: direction as 'BUY' | 'SELL',
      size, stopLevel, dealReference, dealId,
      status: confirmed ? 'open' : 'submitted',
      error: confirmed ? undefined : 'confirmation_pending',
      takeProfitLevel: tp1,
      confirmedAt: confirmed ? new Date() : undefined,
      openedAt: confirmed ? new Date() : undefined,
    });

    return {
      executed: confirmed,
      reason: confirmed ? undefined : 'confirmation_pending',
      dealReference,
    };
  } catch (e) {
    console.error(`[trading-engine] user ${userId} error:`, e);
    return { executed: false, reason: 'internal_error' };
  }
}

async function recordExecution(
  userId: string,
  signal: IngestedSignal,
  args: {
    env: 'demo' | 'live';
    epic: string;
    direction: 'BUY' | 'SELL';
    size: number;
    stopLevel?: number;
    takeProfitLevel?: number;
    status: 'open' | 'submitted' | 'rejected' | 'failed';
    dealReference?: string;
    dealId?: string;
    error?: string;
    confirmedAt?: Date;
    openedAt?: Date;
  }
) {
  try {
    await connectDB();
    // upsert keyed by (userId, chatId, messageId) — one record per user
    // per signal, enforced by the unique index.
    await TradeExecution.updateOne(
      { userId, chatId: signal.chat_id, messageId: signal.message_id },
      {
        $set: {
          environment: args.env,
          epic: args.epic,
          direction: args.direction,
          size: args.size,
          entryLevel: signal.entry,
          stopLevel: args.stopLevel ?? signal.stop_loss,
          takeProfitLevel: args.takeProfitLevel ?? signal.take_profits?.[0],
          dealReference: args.dealReference,
          dealId: args.dealId,
          status: args.status,
          error: args.error ?? null,
          confirmedAt: args.confirmedAt ?? null,
          openedAt: args.openedAt ?? null,
        },
      },
      { upsert: true }
    );
  } catch (e) {
    console.error('[trading-engine] failed to record execution:', e);
  }
}
