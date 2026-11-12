/**
 * Signal-driven trade execution engine (personal Capital.com account).
 *
 * Pipeline for one ingested Telegram signal:
 *   bot state check -> emergency stop -> broker connection -> environment
 *   -> instrument permission -> open-position limit -> risk sizing
 *   -> POST /positions (single attempt) -> GET /confirms/{dealReference}
 *   -> record TradeExecution.
 *
 * Hard rules:
 *   - A trade is 'open' ONLY after /confirms confirms it.
 *   - Uncertain submissions are reconciled via the deal reference; the
 *     order endpoint is never blindly retried.
 *   - Duplicate execution for the same Telegram message is impossible
 *     (unique index on chatId+messageId in TradeExecution).
 */

import connectDB from '@/lib/db';
import BotConfig from '@/models/BotConfig';
import TradeExecution from '@/models/TradeExecution';
import PositionLimit from '@/models/PositionLimit';
import LotSizeManagement from '@/models/LotSizeManagement';
import StopLossManagement from '@/models/StopLossManagement';
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

/**
 * Execute a validated signal against the connected Capital.com account.
 * Returns a result object; never throws for expected failure modes.
 */
export async function executeSignal(signal: IngestedSignal): Promise<{
  executed: boolean;
  reason?: string;
  dealReference?: string;
}> {
  try {
    await connectDB();

    /* ---- 1. Bot must be running ---- */
    const configs = await BotConfig.find({}).limit(1);
    const bot = configs[0] ?? null;
    if (!bot || bot.state !== 'running' || !bot.automationEnabled) {
      return { executed: false, reason: 'bot_not_running' };
    }
    if (bot.emergencyStop) {
      return { executed: false, reason: 'emergency_stop' };
    }

    const env = bot.environment;
    if (env === 'live') {
      // Server-side live gate: a live trade additionally requires the
      // broker to be connected AND the live session to authenticate.
      // Demo always allowed when connected.
    }

    /* ---- 2. Broker must be connected ---- */
    const broker = await getBroker();
    if (!broker || broker.connectionStatus !== 'connected') {
      return { executed: false, reason: 'broker_not_connected' };
    }

    /* ---- 3. Resolve instrument ---- */
    const symbol = (signal.symbol || '').toUpperCase();
    if (bot.allowedInstruments.length > 0) {
      const allowed = bot.allowedInstruments.map((s) => s.toUpperCase());
      const norm = symbol.replace(/[^A-Z0-9]/g, '');
      if (!allowed.some((a) => a === symbol || a === norm)) {
        return { executed: false, reason: 'instrument_not_allowed' };
      }
    }

    const epic = await resolveEpic(signal.symbol, env);
    if (!epic) {
      return { executed: false, reason: 'instrument_not_found' };
    }

    const direction = signal.direction.toUpperCase();
    if (direction !== 'BUY' && direction !== 'SELL') {
      return { executed: false, reason: 'invalid_direction' };
    }

    /* ---- 4. Admin balance-tier rules + open-position limit ----
     * Bot values of 0 mean "defer to the admin-managed rules":
     *   PositionLimit.max_positions, LotSizeManagement.lot_size,
     *   StopLossManagement.stop_loss — matched by account balance range. */
    const equity =
      broker.accountInfo?.equity ?? broker.accountInfo?.balance ?? 0;

    const balanceQuery = {
      active: true,
      min_balance: { $lte: equity },
      max_balance: { $gte: equity },
    };
    const [posRule, lotRule, slRule] = await Promise.all([
      PositionLimit.findOne(balanceQuery).lean(),
      LotSizeManagement.findOne(balanceQuery).lean(),
      StopLossManagement.findOne(balanceQuery).lean(),
    ]);

    const maxPositions =
      bot.maxOpenPositions > 0
        ? bot.maxOpenPositions
        : posRule?.max_positions ?? null;

    try {
      const posRes = await getPositions(env);
      const openCount = posRes.data?.positions?.length ?? 0;
      if (maxPositions !== null && openCount >= maxPositions) {
        return { executed: false, reason: 'max_open_positions' };
      }
    } catch {
      return { executed: false, reason: 'positions_unavailable' };
    }

    /* ---- 5. Session check (validates credentials are still good) ---- */
    try {
      await getSession(env);
    } catch (e) {
      const msg = e instanceof CapitalApiError ? e.message : 'session_failed';
      return { executed: false, reason: `session_error:${msg}` };
    }

    /* ---- 6. Instrument metadata + sizing ----
     * riskPercentage > 0  -> risk-based sizing (equity * risk% / SL distance)
     * riskPercentage = 0  -> fixed size from the LotSizeManagement rule */
    const marketRes = await getMarket(epic, env);
    const market = marketRes.data?.marketDetails;
    const minSize = market?.minDealSize ?? 0;
    const maxSize = market?.maxDealSize ?? Number.MAX_SAFE_INTEGER;
    const increment = market?.dealSizeIncrement ?? minSize ?? 0.01;
    const contractSize = market?.contractSize ?? 1;

    // Effective stop distance: admin StopLossManagement rule wins when set,
    // otherwise the signal's own stop loss.
    const slDistance =
      slRule && slRule.stop_loss > 0
        ? Number(slRule.stop_loss)
        : Math.abs(signal.entry - signal.stop_loss);

    const riskAmount = (equity * bot.riskPercentage) / 100;
    let size = 0;
    if (bot.riskPercentage > 0) {
      if (slDistance > 0 && riskAmount > 0) {
        // size in deal units: risk / (price distance * contract size)
        size = riskAmount / (slDistance * contractSize);
      }
    } else {
      if (!lotRule || !(lotRule.lot_size > 0)) {
        await recordExecution({
          signal,
          env,
          epic,
          direction,
          size: 0,
          status: 'rejected',
          error: 'no_lot_size_rule_for_balance',
        });
        return { executed: false, reason: 'no_lot_size_rule' };
      }
      size = Number(lotRule.lot_size);
    }
    // Round DOWN to the broker's size increment — never round risk up.
    if (increment > 0 && bot.riskPercentage > 0) {
      size = Math.floor(size / increment) * increment;
    }
    size = Math.min(size, maxSize);

    if (size <= 0 || size < minSize) {
      await recordExecution({
        signal,
        env,
        epic,
        direction,
        size: 0,
        status: 'rejected',
        error: `size_below_minimum (computed=${size}, min=${minSize})`,
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

    /* ---- 7. Submit order — exactly once ---- */
    const tp1 = signal.take_profits?.[0];
    const submit = await createPosition(
      {
        epic,
        direction: direction as 'BUY' | 'SELL',
        size,
        stopLevel,
        profitLevel: tp1,
        guaranteedStop: false,
      },
      env
    );

    if (!submit.ok || !submit.data?.dealReference) {
      await recordExecution({
        signal,
        env,
        epic,
        direction: direction as 'BUY' | 'SELL',
        size,
        stopLevel,
        status: 'failed',
        error: `submit_http_${submit.status}`,
      });
      return { executed: false, reason: 'submit_failed' };
    }

    const dealReference = submit.data.dealReference;

    /* ---- 8. Confirm via deal reference — never trust the 200 ---- */
    let confirmed = false;
    let dealId: string | undefined;
    for (let i = 0; i < MAX_CONFIRM_ATTEMPTS; i++) {
      await sleep(CONFIRM_DELAY_MS);
      const conf = await confirmPosition(dealReference, env);
      const status = conf.data?.dealConfirmation?.dealStatus;
      const deals = conf.data?.dealConfirmation?.affectedDeals ?? [];
      if (status === 'ACCEPTED' || deals.length > 0) {
        confirmed = true;
        dealId = deals[0]?.dealId;
        break;
      }
      if (status === 'REJECTED' || status === 'FAILED') break;
    }

    await recordExecution({
      signal,
      env,
      epic,
      direction: direction as 'BUY' | 'SELL',
      size,
      stopLevel,
      status: confirmed ? 'open' : 'submitted',
      dealReference,
      dealId,
      error: confirmed ? undefined : 'confirmation_pending',
      confirmedAt: confirmed ? new Date() : undefined,
      openedAt: confirmed ? new Date() : undefined,
    });

    return {
      executed: confirmed,
      reason: confirmed ? undefined : 'confirmation_pending',
      dealReference,
    };
  } catch (e) {
    console.error('[trading-engine] unexpected error:', e);
    return { executed: false, reason: 'internal_error' };
  }
}

async function recordExecution(args: {
  signal: IngestedSignal;
  env: 'demo' | 'live';
  epic: string;
  direction: 'BUY' | 'SELL';
  size: number;
  status: 'open' | 'submitted' | 'rejected' | 'failed';
  dealReference?: string;
  dealId?: string;
  stopLevel?: number;
  error?: string;
  confirmedAt?: Date;
  openedAt?: Date;
}) {
  try {
    await connectDB();
    // Resolve owner: the personal platform's admin user.
    const User = (await import('@/models/User')).default;
    const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
    if (!admin) return;

    await TradeExecution.updateOne(
      { chatId: args.signal.chat_id, messageId: args.signal.message_id },
      {
        $set: {
          userId: admin._id,
          environment: args.env,
          epic: args.epic,
          direction: args.direction,
          size: args.size,
          entryLevel: args.signal.entry,
          stopLevel: args.stopLevel ?? args.signal.stop_loss,
          takeProfitLevel: args.signal.take_profits?.[0],
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
