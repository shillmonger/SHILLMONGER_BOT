/**
 * Signal-driven trade execution engine (multi-user Capital.com).
 *
 * Pipeline per evaluated user for one ingested Telegram signal:
 *   bot running + automationEnabled + !emergencyStop
 *   -> broker connected + active + demo/live environment
 *   -> instrument allowlist -> admin balance-tier rules
 *   -> open-position limit -> session check -> epic resolution
 *   -> risk sizing (bot risk% or admin lot-size rule)
 *   -> order-type resolution (MARKET / LIMIT / STOP / PENDING)
 *   -> POST /positions OR POST /workingOrders (single attempt)
 *   -> GET /confirms/{dealReference} -> TradeExecution record.
 *
 * Every evaluated user also gets a SignalEvaluation document recording
 * whether they were eligible and, if not, which gate stopped them.
 *
 * Hard rules:
 *   - Only XAUUSD (gold) signals are traded.
 *   - A trade is 'open'/'pending' ONLY after /confirms confirms it.
 *   - Order submission is never blindly retried; uncertain outcomes are
 *     reconciled via the deal reference.
 *   - One execution per (userId, chatId, messageId) — unique index.
 *   - One user's failure never blocks another user's execution.
 *   - A user with a resting working order never gets a second pending
 *     order from the same or a later signal.
 */

import connectDB from '@/lib/db';
import BotConfig, { IBotConfig } from '@/models/BotConfig';
import TradeExecution from '@/models/TradeExecution';
import PositionLimit from '@/models/PositionLimit';
import LotSizeManagement from '@/models/LotSizeManagement';
import StopLossManagement from '@/models/StopLossManagement';
import TPMatrix from '@/models/TPMatrix';
import SignalEvaluation from '@/models/SignalEvaluation';
import { recordNotification } from '@/lib/notifications';
import {
  getBroker,
  getSession,
  getPositions,
  getOrders,
  getMarket,
  getPrice,
  resolveEpic,
  createPosition,
  createWorkingOrder,
  confirmPosition,
  CapitalApiError,
} from '@/lib/capitalcom';

export interface IngestedSignal {
  chat_id: number;
  message_id: number;
  symbol: string;
  direction: string;
  entry: number;
  entry_high?: number | null;
  entry_low?: number | null;
  stop_loss: number;
  take_profits: number[];
  order_type?: string;
  group_name?: string;
  confidence?: number;
  /** Ingest-side signal document id, when available */
  _id?: unknown;
}

const MAX_CONFIRM_ATTEMPTS = 5;
const CONFIRM_DELAY_MS = 1500;
/** Working (pending) orders expire after this many days */
const WORKING_ORDER_TTL_DAYS = 7;

type OrderKind = 'MARKET' | 'LIMIT' | 'STOP';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** We only trade gold — XAUUSD in any broker suffix form, or GOLD. */
function isGoldSymbol(symbol: string | undefined): boolean {
  const norm = (symbol || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return norm.startsWith('XAUUSD') || norm === 'GOLD';
}

/**
 * Resolve the signal's order_type + entry vs the live quote into the
 * order kind Capital.com should receive.
 *
 *   MARKET            -> immediate position
 *   *_LIMIT / *_STOP  -> resting working order at signal.entry
 *   PENDING / unknown -> auto-detect from current price:
 *       BUY : entry < offer -> LIMIT, entry > offer -> STOP, else MARKET
 *       SELL: entry > bid   -> LIMIT, entry < bid   -> STOP, else MARKET
 *     No quote available -> LIMIT (resting at entry beats chasing market).
 */
function resolveOrderKind(
  signal: IngestedSignal,
  direction: 'BUY' | 'SELL',
  bid?: number,
  offer?: number
): OrderKind {
  const raw = (signal.order_type || '').toUpperCase();
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('STOP')) return 'STOP';
  if (raw === 'MARKET' || raw.includes('NOW')) return 'MARKET';

  // PENDING / unspecified — auto-detect against the live quote.
  const price = direction === 'BUY' ? offer ?? bid : bid ?? offer;
  if (price === undefined || !Number.isFinite(price) || price <= 0) {
    return 'LIMIT';
  }
  if (direction === 'BUY') {
    if (signal.entry < price) return 'LIMIT';
    if (signal.entry > price) return 'STOP';
    return 'MARKET';
  }
  if (signal.entry > price) return 'LIMIT';
  if (signal.entry < price) return 'STOP';
  return 'MARKET';
}

interface ExecResult {
  executed: boolean;
  eligible: boolean;
  reason?: string;
  dealReference?: string;
}

/**
 * Fan-out entry point: find every armed user and evaluate the signal
 * independently for each. Called (fire-and-forget) by the ingest route
 * after a signal is stored.
 */
export async function executeSignal(signal: IngestedSignal): Promise<void> {
  try {
    // Gold-only mandate — skip fan-out entirely for other symbols.
    if (!isGoldSymbol(signal.symbol)) {
      console.log(
        `[trading-engine] skipping non-gold signal ${signal.symbol} ` +
          `(chat ${signal.chat_id} msg ${signal.message_id})`
      );
      return;
    }

    await connectDB();
    // Every running, non-emergency-stopped bot is EVALUATED — including
    // automation-disabled ones, so the eligibility DB shows the full
    // picture of who could/couldn't take the signal.
    const bots = await BotConfig.find({
      state: 'running',
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

  /** Record an ineligible outcome and return the ExecResult. */
  const deny = async (
    stage: string,
    reason: string,
    executionId?: string
  ): Promise<ExecResult> => {
    await recordEvaluation(userId, signal, {
      environment: env,
      eligible: false,
      stage,
      reason,
      executionId,
    });
    return { executed: false, eligible: false, reason };
  };

  try {
    /* ---- Bot-level gates ---- */
    if (!bot.automationEnabled) {
      return deny('bot_config', 'automation_disabled');
    }

    /* ---- Broker must be connected + active for THIS user ---- */
    const broker = await getBroker(userId);
    if (!broker || broker.connectionStatus !== 'connected') {
      return deny('broker', 'broker_not_connected');
    }
    if (broker.status === 'disabled') {
      return deny('broker', 'broker_disabled');
    }
    if (broker.environment !== 'demo' && broker.environment !== 'live') {
      return deny('broker', 'broker_invalid_environment');
    }

    /* ---- Instrument allowlist (bot-level, optional) ---- */
    const symbol = (signal.symbol || '').toUpperCase();
    if (bot.allowedInstruments.length > 0) {
      const allowed = bot.allowedInstruments.map((s) => s.toUpperCase());
      const norm = symbol.replace(/[^A-Z0-9]/g, '');
      if (!allowed.some((a) => a === symbol || a === norm)) {
        return deny('instrument', 'instrument_not_allowed');
      }
    }

    const direction = signal.direction.toUpperCase();
    if (direction !== 'BUY' && direction !== 'SELL') {
      return deny('instrument', 'invalid_direction');
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

    /* ---- Open-position limit ----
     * Only call the broker when a limit actually applies — no configured
     * limit means the check can't fail and the API call is wasted. */
    if (maxPositions !== null) {
      try {
        const posRes = await getPositions(userId, env);
        const openCount = posRes.data?.positions?.length ?? 0;
        if (openCount >= maxPositions) {
          return deny('position_limit', 'max_open_positions');
        }
      } catch {
        return deny('position_limit', 'positions_unavailable');
      }
    }

    /* ---- Session check ---- */
    try {
      await getSession(userId, env);
    } catch (e) {
      const msg = e instanceof CapitalApiError ? e.message : 'session_failed';
      return deny('session', `session_error:${msg}`);
    }

    /* ---- Instrument resolution ---- */
    const epic = await resolveEpic(userId, signal.symbol, env);
    if (!epic) {
      return deny('instrument_resolution', 'instrument_not_found');
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

    /* ---- Live quote for order-type resolution ----
     * marketDetails.snapshot is not reliably populated — the dedicated
     * /prices endpoint is. Only needed when the signal isn't explicitly
     * MARKET; market orders don't care about the quote. */
    const rawOrderType = (signal.order_type || '').toUpperCase();
    const needsQuote =
      rawOrderType !== 'MARKET' && !rawOrderType.includes('NOW');
    let bid = market?.snapshot?.bid;
    let offer = market?.snapshot?.offer;
    if (needsQuote) {
      try {
        const priceRes = await getPrice(userId, epic, env);
        const snap =
          priceRes.data?.prices?.snapshot ?? priceRes.data?.snapshot;
        if (snap?.bid !== undefined) bid = snap.bid;
        if (snap?.offer !== undefined) offer = snap.offer;
      } catch {
        // Quote fetch failed — fall back to whatever /markets gave us.
      }
    }

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
        const execId = await recordExecution(userId, signal, {
          env, epic, direction: direction as 'BUY' | 'SELL',
          size: 0, status: 'rejected', error: 'no_lot_size_rule_for_balance',
          takeProfitLevel: tp1,
        });
        return deny('sizing', 'no_lot_size_rule', execId);
      }
      size = Number(lotRule.lot_size);
    }
    if (increment > 0 && bot.riskPercentage > 0) {
      size = Math.floor(size / increment) * increment;
    }
    size = Math.min(size, maxSize);

    if (size <= 0 || size < minSize) {
      const execId = await recordExecution(userId, signal, {
        env, epic, direction: direction as 'BUY' | 'SELL',
        size: 0, status: 'rejected',
        error: `size_below_minimum (computed=${size}, min=${minSize})`,
        takeProfitLevel: tp1,
      });
      return deny('sizing', 'size_below_minimum', execId);
    }

    // Effective stop level: admin SL distance overrides the signal SL.
    const stopLevel =
      slRule && slRule.stop_loss > 0
        ? direction === 'BUY'
          ? signal.entry - Number(slRule.stop_loss)
          : signal.entry + Number(slRule.stop_loss)
        : signal.stop_loss;

    /* ---- Order-type resolution ---- */
    const orderKind = resolveOrderKind(
      signal,
      direction as 'BUY' | 'SELL',
      bid,
      offer
    );

    /* ---- Pending order path (LIMIT / STOP working orders) ---- */
    if (orderKind !== 'MARKET') {
      return submitWorkingOrder({
        signal, bot, userId, env, epic,
        direction: direction as 'BUY' | 'SELL',
        size, stopLevel, tp1, orderKind, bid, offer,
      });
    }

    /* ---- Market order — submit exactly once ---- */
    const submit = await createPosition(userId, {
      epic,
      direction: direction as 'BUY' | 'SELL',
      size,
      stopLevel,
      profitLevel: tp1,
      guaranteedStop: false,
    }, env);

    if (!submit.ok || !submit.data?.dealReference) {
      const brokerError =
        typeof submit.data === 'object' && submit.data !== null
          ? JSON.stringify(submit.data).slice(0, 300)
          : '';
      const execId = await recordExecution(userId, signal, {
        env, epic, direction: direction as 'BUY' | 'SELL',
        size, stopLevel, status: 'failed', orderType: 'MARKET',
        error: `submit_http_${submit.status}${brokerError ? ` ${brokerError}` : ''}`,
        takeProfitLevel: tp1,
      });
      await recordEvaluation(userId, signal, {
        environment: env, eligible: true, stage: 'order_submit',
        reason: `submit_http_${submit.status}${brokerError ? ` ${brokerError}` : ''}`,
        executionId: execId,
      });
      return {
        executed: false, eligible: true, reason: 'submit_failed',
      };
    }

    const dealReference = submit.data.dealReference;
    const { confirmed, dealId } = await confirmWithRetry(userId, dealReference, env);

    const execId = await recordExecution(userId, signal, {
      env, epic, direction: direction as 'BUY' | 'SELL',
      size, stopLevel, dealReference, dealId,
      status: confirmed ? 'open' : 'submitted', orderType: 'MARKET',
      error: confirmed ? undefined : 'confirmation_pending',
      takeProfitLevel: tp1,
      confirmedAt: confirmed ? new Date() : undefined,
      openedAt: confirmed ? new Date() : undefined,
    });

    await recordEvaluation(userId, signal, {
      environment: env,
      eligible: true,
      stage: confirmed ? 'confirmed' : 'order_submit',
      reason: confirmed ? undefined : 'confirmation_pending',
      executionId: execId,
    });

    return {
      executed: confirmed,
      eligible: true,
      reason: confirmed ? undefined : 'confirmation_pending',
      dealReference,
    };
  } catch (e) {
    console.error(`[trading-engine] user ${userId} error:`, e);
    await recordEvaluation(userId, signal, {
      environment: env, eligible: false, stage: 'internal',
      reason: 'internal_error',
    });
    return { executed: false, eligible: false, reason: 'internal_error' };
  }
}

/**
 * Place a resting LIMIT/STOP working order for a user.
 * Blocked when the user already has ANY working order resting — one
 * pending trade per user, per the product rule.
 */
async function submitWorkingOrder(args: {
  signal: IngestedSignal;
  bot: IBotConfig;
  userId: string;
  env: 'demo' | 'live';
  epic: string;
  direction: 'BUY' | 'SELL';
  size: number;
  stopLevel: number;
  tp1?: number;
  orderKind: 'LIMIT' | 'STOP';
  bid?: number;
  offer?: number;
}): Promise<ExecResult> {
  const { signal, userId, env, epic, direction, size, stopLevel, tp1, orderKind, bid, offer } = args;

  const deny = async (stage: string, reason: string): Promise<ExecResult> => {
    await recordEvaluation(userId, signal, {
      environment: env, eligible: false, stage, reason,
    });
    return { executed: false, eligible: false, reason };
  };

  try {
    /* ---- One pending trade per user ---- */
    try {
      const ordersRes = await getOrders(userId, env);
      if (!ordersRes.ok) {
        console.error(
          `[trading-engine] orders check failed user=${userId} ` +
            `env=${env} status=${ordersRes.status}`
        );
        return deny(
          'pending_order_check',
          `orders_http_${ordersRes.status}`
        );
      }
      const resting =
        ordersRes.data?.workingOrders ?? ordersRes.data?.orders ?? [];
      if (resting.length > 0) {
        return deny('pending_order_check', 'pending_order_exists');
      }
    } catch (e) {
      console.error(`[trading-engine] orders check threw user=${userId}:`, e);
      return deny('pending_order_check', 'orders_unavailable');
    }

    /* ---- Level must sit on the correct side of the market ----
     * LIMIT buys trigger BELOW the offer, LIMIT sells ABOVE the bid;
     * STOPs are the mirror image. A wrong-side level is an HTTP 400. */
    const level = signal.entry;
    const refBid = bid ?? offer;
    const refOffer = offer ?? bid;
    if (refBid !== undefined && refOffer !== undefined) {
      const wrongSide =
        (orderKind === 'LIMIT' &&
          ((direction === 'BUY' && level >= refOffer) ||
            (direction === 'SELL' && level <= refBid))) ||
        (orderKind === 'STOP' &&
          ((direction === 'BUY' && level <= refOffer) ||
            (direction === 'SELL' && level >= refBid)));
      if (wrongSide) {
        return deny(
          'order_submit',
          `level_wrong_side (${orderKind} ${direction} @ ${level}, bid=${refBid} offer=${refOffer})`
        );
      }
    }

    /* ---- Submit working order — exactly once ----
     * Capital.com requires goodTillDate as YYYY-MM-DDTHH:MM:SS (UTC,
     * no milliseconds, no trailing Z) — toISOString() produces
     * "...42.716Z" which the API rejects with HTTP 400. */
    const expiry = new Date(Date.now() + WORKING_ORDER_TTL_DAYS * 86400_000);
    const goodTillDate = expiry.toISOString().slice(0, 19);

    const submit = await createWorkingOrder(userId, {
      epic,
      direction,
      type: orderKind,
      size,
      level: signal.entry,
      stopLevel,
      profitLevel: tp1,
      goodTillDate,
    }, env);

    const dealReference =
      submit.data?.dealReference ?? submit.data?.workingOrder?.dealReference;

    if (!submit.ok || !dealReference) {
      // Broker error bodies now carry the rejection reason — keep it.
      const brokerError =
        typeof submit.data === 'object' && submit.data !== null
          ? JSON.stringify(submit.data).slice(0, 300)
          : '';
      const execId = await recordExecution(userId, signal, {
        env, epic, direction, size, stopLevel,
        status: 'failed', orderType: orderKind,
        error: `submit_http_${submit.status}${brokerError ? ` ${brokerError}` : ''}`,
        takeProfitLevel: tp1,
      });
      await recordEvaluation(userId, signal, {
        environment: env, eligible: true, stage: 'order_submit',
        reason: `submit_http_${submit.status}${brokerError ? ` ${brokerError}` : ''}`,
        executionId: execId,
      });
      return { executed: false, eligible: true, reason: 'submit_failed' };
    }

    const { confirmed: confConfirmed, dealId: confDealId } =
      await confirmWithRetry(userId, dealReference, env, true);

    /* Fallback: /confirms can lag for working orders. Verify the order is
     * actually resting by listing working orders and matching on
     * epic + direction + level. */
    let confirmed = confConfirmed;
    let dealId = confDealId;
    if (!confirmed) {
      try {
        const ordersRes = await getOrders(userId, env);
        const resting =
          ordersRes.data?.workingOrders ?? ordersRes.data?.orders ?? [];
        const match = resting.find((o) => {
          const w =
            (o as { workingOrderData?: Record<string, unknown> })
              .workingOrderData ?? (o as Record<string, unknown>);
          const lvl = Number(w.orderLevel ?? w.level);
          return (
            String(w.epic ?? '').toUpperCase() === epic &&
            String(w.direction ?? '').toUpperCase() === direction &&
            Math.abs(lvl - signal.entry) < 0.5
          );
        });
        if (match) {
          confirmed = true;
          const w =
            (match as { workingOrderData?: Record<string, unknown> })
              .workingOrderData ?? (match as Record<string, unknown>);
          dealId =
            (w.dealId as string | undefined) ??
            (w.workingOrderId as string | undefined) ??
            dealId;
        }
      } catch {
        // Verification failed — leave as 'submitted' for later reconcile.
      }
    }

    const execId = await recordExecution(userId, signal, {
      env, epic, direction, size, stopLevel,
      dealReference, dealId,
      status: confirmed ? 'pending' : 'submitted',
      orderType: orderKind,
      error: confirmed ? undefined : 'confirmation_pending',
      takeProfitLevel: tp1,
      confirmedAt: confirmed ? new Date() : undefined,
    });

    await recordEvaluation(userId, signal, {
      environment: env,
      eligible: true,
      stage: confirmed ? 'confirmed' : 'order_submit',
      reason: confirmed ? undefined : 'confirmation_pending',
      executionId: execId,
    });

    return {
      executed: confirmed,
      eligible: true,
      reason: confirmed ? undefined : 'confirmation_pending',
      dealReference,
    };
  } catch (e) {
    console.error(`[trading-engine] pending order user ${userId} error:`, e);
    await recordEvaluation(userId, signal, {
      environment: env, eligible: false, stage: 'internal',
      reason: 'internal_error',
    });
    return { executed: false, eligible: false, reason: 'internal_error' };
  }
}

/**
 * Poll GET /confirms/{dealReference} until the broker reports a terminal
 * state. Handles BOTH confirmation envelopes: dealConfirmation (positions)
 * and workingOrderConfirmation (working orders).
 */
async function confirmWithRetry(
  userId: string,
  dealReference: string,
  env: 'demo' | 'live',
  isWorkingOrder = false
): Promise<{ confirmed: boolean; dealId?: string }> {
  for (let i = 0; i < MAX_CONFIRM_ATTEMPTS; i++) {
    await sleep(CONFIRM_DELAY_MS);
    const conf = await confirmPosition(userId, dealReference, env);
    const c =
      conf.data?.dealConfirmation ?? conf.data?.workingOrderConfirmation;
    const status = c?.dealStatus;
    const deals = c?.affectedDeals ?? [];
    const workingOrder = c?.workingOrder;

    const accepted =
      status === 'ACCEPTED' ||
      deals.length > 0 ||
      (isWorkingOrder && !!workingOrder);

    if (accepted) {
      return {
        confirmed: true,
        dealId:
          deals[0]?.dealId ??
          workingOrder?.workingOrderId ??
          workingOrder?.dealId,
      };
    }
    if (status === 'REJECTED' || status === 'FAILED') break;
  }
  return { confirmed: false };
}

/** Upsert the eligibility record for (signal, user). */
async function recordEvaluation(
  userId: string,
  signal: IngestedSignal,
  fields: {
    environment: 'demo' | 'live';
    eligible: boolean;
    stage: string;
    reason?: string;
    executionId?: string;
  }
) {
  try {
    await connectDB();
    await SignalEvaluation.updateOne(
      {
        signalChatId: signal.chat_id,
        signalMessageId: signal.message_id,
        userId,
      },
      {
        $set: {
          signalRefId:
            signal._id !== undefined ? String(signal._id) : null,
          environment: fields.environment,
          symbol: signal.symbol ?? '',
          direction: signal.direction ?? '',
          groupName: signal.group_name ?? null,
          orderType: signal.order_type ?? null,
          eligible: fields.eligible,
          stage: fields.stage,
          reason: fields.reason ?? null,
          executionId: fields.executionId ?? null,
          evaluatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (e) {
    console.error('[trading-engine] failed to record evaluation:', e);
  }
}

/** Upsert the execution record; returns its _id for eligibility linking. */
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
    orderType?: string;
    status: 'pending' | 'open' | 'submitted' | 'rejected' | 'failed';
    dealReference?: string;
    dealId?: string;
    error?: string;
    confirmedAt?: Date;
    openedAt?: Date;
  }
): Promise<string | undefined> {
  try {
    await connectDB();
    // upsert keyed by (userId, chatId, messageId) — one record per user
    // per signal, enforced by the unique index.
    const doc = await TradeExecution.findOneAndUpdate(
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
          signalId: signal._id !== undefined ? String(signal._id) : null,
          symbol: signal.symbol ?? null,
          groupName: signal.group_name ?? null,
          orderType: args.orderType ?? signal.order_type ?? null,
          dealReference: args.dealReference,
          dealId: args.dealId,
          status: args.status,
          error: args.error ?? null,
          confirmedAt: args.confirmedAt ?? null,
          openedAt: args.openedAt ?? null,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    const execId = doc?._id ? String(doc._id) : undefined;

    /* Activity feed: notify on executions that reached a meaningful
     * state. 'submitted' is skipped — the monitor records the open. */
    const symbol = signal.symbol ?? args.epic;
    const base = `${args.direction} ${symbol} x${args.size} (${args.env.toUpperCase()})`;
    if (args.status === 'open') {
      void recordNotification({
        userId, actor: 'system', type: 'trade.opened', category: 'trading',
        title: 'Trade opened',
        message: `Trade opened: ${base} @ ${signal.entry}.`,
        metadata: { executionId: execId, epic: args.epic, direction: args.direction, size: args.size, entry: signal.entry, environment: args.env, orderType: args.orderType ?? signal.order_type ?? null, groupName: signal.group_name ?? null },
        source: 'lib/trading-engine',
      });
    } else if (args.status === 'pending') {
      void recordNotification({
        userId, actor: 'system', type: 'trade.order_placed', category: 'trading',
        title: 'Pending order placed',
        message: `Pending ${args.orderType ?? signal.order_type ?? 'order'} placed: ${base} @ ${signal.entry}.`,
        metadata: { executionId: execId, epic: args.epic, direction: args.direction, size: args.size, entry: signal.entry, environment: args.env, orderType: args.orderType ?? signal.order_type ?? null, groupName: signal.group_name ?? null },
        source: 'lib/trading-engine',
      });
    } else if (args.status === 'failed' || args.status === 'rejected') {
      void recordNotification({
        userId, actor: 'system', type: `trade.${args.status}`, category: 'trading',
        title: args.status === 'failed' ? 'Trade failed' : 'Trade rejected',
        message: `Trade ${args.status}: ${base} — ${args.error ?? 'unknown error'}.`,
        metadata: { executionId: execId, epic: args.epic, direction: args.direction, size: args.size, environment: args.env, orderType: args.orderType ?? signal.order_type ?? null, error: args.error ?? null, groupName: signal.group_name ?? null },
        source: 'lib/trading-engine',
      });
    }

    return execId;
  } catch (e) {
    console.error('[trading-engine] failed to record execution:', e);
    return undefined;
  }
}
