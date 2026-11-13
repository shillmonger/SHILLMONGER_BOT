/**
 * Trade lifecycle monitor.
 *
 * Reconciles TRADE_EXECUTIONS records against the live Capital.com state
 * for every user that has non-terminal executions:
 *
 *   submitted  -> re-poll GET /confirms/{dealReference}
 *                 ACCEPTED  -> open (dealId captured)
 *                 REJECTED/FAILED -> failed
 *   pending    -> resting working order (LIMIT/STOP)
 *                 still in GET /workingorders        -> nothing
 *                 gone + matching open position      -> open (filled)
 *                 gone + no position                 -> cancelled
 *   open       -> dealId still in GET /positions     -> nothing
 *                 dealId gone                        -> closed
 *                   (realizedPnl + closedAt pulled from /history/activity)
 *
 * Every transition also updates the linked SIGNAL_EVALUATIONS doc
 * (matched by executionId) so the eligibility trail reflects the final
 * trade state: trade_open / trade_closed / trade_failed / trade_cancelled.
 *
 * Called by POST /api/internal/trade-monitor (HMAC), which the Python
 * worker pings on an interval — the bot is the scheduler, this module
 * owns all broker I/O.
 */

import connectDB from '@/lib/db';
import TradeExecution from '@/models/TradeExecution';
import SignalEvaluation from '@/models/SignalEvaluation';
import {
  getOrders,
  getPositions,
  getHistoryActivity,
  getTransactions,
  confirmPosition,
  type CapitalActivity,
  type CapitalPositionEntry,
  type CapitalTransaction,
  type CapitalWorkingOrder,
} from '@/lib/capitalcom';

const NON_TERMINAL = ['pending', 'submitted', 'open'] as const;

interface ExecDoc {
  _id: import('mongoose').Types.ObjectId;
  userId: unknown;
  environment: 'demo' | 'live';
  epic: string;
  direction: 'BUY' | 'SELL';
  entryLevel?: number | null;
  size?: number;
  status: string;
  dealReference?: string;
  dealId?: string;
  confirmedAt?: Date | null;
  openedAt?: Date | null;
  createdAt?: Date;
}

export interface MonitorSummary {
  users: number;
  checked: number;
  opened: number;
  closed: number;
  cancelled: number;
  failed: number;
  unchanged: number;
  errors: number;
}

type WorkingOrderEntry =
  | ({ workingOrderData?: CapitalWorkingOrder } & CapitalWorkingOrder)
  | Record<string, unknown>;

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}

/** All id-ish fields a working order may expose across API shapes. */
function workingOrderIds(o: WorkingOrderEntry): string[] {
  const w = asRecord((o as { workingOrderData?: unknown }).workingOrderData) ;
  const flat = o as Record<string, unknown>;
  return [
    w.dealId, w.workingOrderId, w.id,
    flat.workingOrderId, flat.dealId, flat.id,
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function positionDealId(p: CapitalPositionEntry): string | null {
  const pos = asRecord(p.position);
  const v = pos.dealId ?? pos.dealReference;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function positionLevel(p: CapitalPositionEntry): number | null {
  const v = asRecord(p.position).level;
  return typeof v === 'number' ? v : null;
}

function positionEpic(p: CapitalPositionEntry): string {
  const m = asRecord(p.market);
  const e = m.epic;
  return typeof e === 'string' ? e.toUpperCase() : '';
}

function positionDirection(p: CapitalPositionEntry): string {
  const v = asRecord(p.position).direction;
  return typeof v === 'string' ? v.toUpperCase() : '';
}

function positionOpenedAt(p: CapitalPositionEntry): Date | undefined {
  const v = asRecord(p.position).createdDate;
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function activityTime(a: CapitalActivity): number {
  const raw =
    (a.closedDate as string | undefined) ??
    a.dateUTC ??
    a.date ??
    a.createdDateUTC ??
    a.createdDate ??
    '';
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : 0;
}

/**
 * Does this history activity belong to this execution?
 *  1) any *dealId-ish field equals the position dealId, OR
 *  2) same epic + direction + entry level (±2) + not before openedAt.
 */
function activityMatchesExec(a: CapitalActivity, exec: ExecDoc): boolean {
  for (const [k, v] of Object.entries(a)) {
    if (
      typeof v === 'string' &&
      /dealid$/i.test(k) &&
      v === exec.dealId
    ) {
      return true;
    }
  }
  const epic = typeof a.epic === 'string' ? a.epic.toUpperCase() : '';
  if (!exec.epic || epic !== exec.epic.toUpperCase()) return false;
  // detailed=true nests direction/level/size under `details`.
  const d = asRecord(a.details);
  const dirRaw = a.direction ?? d.direction;
  const dir = typeof dirRaw === 'string' ? dirRaw.toUpperCase() : '';
  if (exec.direction && dir && dir !== exec.direction) return false;
  const lvlRaw = a.level ?? d.level;
  const lvl = typeof lvlRaw === 'number' ? lvlRaw : toNumber(lvlRaw);
  if (
    exec.entryLevel != null &&
    lvl != null &&
    Math.abs(lvl - exec.entryLevel) > 2
  ) {
    return false;
  }
  if (exec.openedAt) {
    const t = activityTime(a);
    if (t > 0 && t < new Date(exec.openedAt).getTime() - 10 * 60_000) {
      return false;
    }
  }
  return true;
}

function activityLevel(a: CapitalActivity): number | null {
  const d = asRecord(a.details);
  return toNumber(d.level ?? a.level);
}

function toNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function transactionTime(t: CapitalTransaction): number {
  const raw = t.dateUtc ?? t.dateUTC ?? t.date ?? '';
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Does this TRADE transaction correspond to this execution?
 * Transactions have no dealId — match on instrument + size + open level
 * + timestamp after the position opened.
 */
function transactionMatchesExec(t: CapitalTransaction, exec: ExecDoc): boolean {
  // Transactions carry the position dealId — exact match wins outright.
  if (exec.dealId && t.dealId === exec.dealId) return true;
  const type = String(t.transactionType ?? t.type ?? '').toUpperCase();
  const note = String(t.note ?? '').toLowerCase();
  if (type !== 'TRADE' && type !== '' && !note.includes('closed') && !note.includes('trade')) {
    return false;
  }
  const inst = String(t.instrumentName ?? '').toUpperCase();
  if (exec.epic && inst && inst !== exec.epic.toUpperCase() &&
      !inst.includes(exec.epic.toUpperCase())) {
    return false;
  }
  const size = toNumber(t.size);
  if (exec.size != null && size != null && Math.abs(size - exec.size) > 0.001) {
    return false;
  }
  const openLevel = toNumber(t.openLevel);
  if (exec.entryLevel != null && openLevel != null &&
      Math.abs(openLevel - exec.entryLevel) > 2) {
    return false;
  }
  if (exec.openedAt) {
    const tt = transactionTime(t);
    if (tt > 0 && tt < new Date(exec.openedAt).getTime() - 10 * 60_000) {
      return false;
    }
  }
  return true;
}

function flattenActivities(
  activities: Array<{ activity?: CapitalActivity } & CapitalActivity> | undefined
): CapitalActivity[] {
  return (activities ?? []).map(
    (e) => (e as { activity?: CapitalActivity }).activity ?? (e as CapitalActivity)
  );
}

/**
 * Sync every non-terminal execution against the broker. `userId` scopes
 * the run to one user; omit to sweep all users.
 */
export async function syncTradeLifecycles(userId?: string): Promise<MonitorSummary> {
  const summary: MonitorSummary = {
    users: 0, checked: 0, opened: 0, closed: 0,
    cancelled: 0, failed: 0, unchanged: 0, errors: 0,
  };

  await connectDB();
  // Non-terminal trades always; recently-closed trades missing realizedPnl
  // or exitLevel are retried for 3 days so close data backfills once
  // history catches up.
  const pnlRetryCutoff = new Date(Date.now() - 3 * 86400_000);
  const execs = (await TradeExecution.find({
    $or: [
      { status: { $in: [...NON_TERMINAL] } },
      {
        status: 'closed',
        closedAt: { $gte: pnlRetryCutoff },
        $or: [{ realizedPnl: null }, { exitLevel: null }],
      },
    ],
    ...(userId ? { userId } : {}),
  }).lean()) as unknown as ExecDoc[];

  if (execs.length === 0) return summary;

  // Group by user + environment so broker calls are shared per account.
  const groups = new Map<string, ExecDoc[]>();
  for (const e of execs) {
    const key = `${String(e.userId)}|${e.environment}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  summary.users = groups.size;

  for (const [key, group] of groups) {
    const [uid, env] = key.split('|') as [string, 'demo' | 'live'];
    try {
      await syncGroup(uid, env, group, summary);
    } catch (e) {
      summary.errors += 1;
      console.error(`[trade-monitor] user ${uid} env ${env} sync failed:`, e);
    }
  }

  return summary;
}

async function syncGroup(
  userId: string,
  env: 'demo' | 'live',
  execs: ExecDoc[],
  summary: MonitorSummary
) {
  const [ordersRes, posRes] = await Promise.all([
    getOrders(userId, env),
    getPositions(userId, env),
  ]);

  // If the broker is unreachable we can't verify anything — skip the
  // whole group rather than mass-marking trades closed.
  if (!ordersRes.ok || !posRes.ok) {
    summary.errors += execs.length;
    console.error(
      `[trade-monitor] broker unreachable user=${userId} env=${env} ` +
        `orders=${ordersRes.status} positions=${posRes.status}`
    );
    return;
  }

  const workingOrders = (ordersRes.data?.workingOrders ??
    ordersRes.data?.orders ??
    []) as WorkingOrderEntry[];
  const positions = posRes.data?.positions ?? [];

  // History is only fetched lazily if a close is actually detected.
  // detailed=true is required — P/L fields are absent otherwise. The
  // window starts at the earliest exec open time (chunked into <=1-day
  // requests inside getHistoryActivity).
  let historyCache: CapitalActivity[] | null = null;
  const getHistory = async (): Promise<CapitalActivity[]> => {
    if (historyCache) return historyCache;
    const earliest = execs.reduce((min, e) => {
      const t = new Date(e.openedAt ?? e.createdAt ?? Date.now()).getTime();
      return Number.isFinite(t) && t < min ? t : min;
    }, Date.now());
    const res = await getHistoryActivity(
      userId,
      {
        from: new Date(earliest - 3600_000).toISOString(),
        to: new Date().toISOString(),
        detailed: true,
      },
      env
    );
    historyCache = res.ok ? flattenActivities(res.data?.activities) : [];
    return historyCache;
  };

  // Transaction history carries realized P/L ('pnl' on TRADE entries).
  let txCache: CapitalTransaction[] | null = null;
  const getTxnHistory = async (): Promise<CapitalTransaction[]> => {
    if (txCache) return txCache;
    const earliest = execs.reduce((min, e) => {
      const t = new Date(e.openedAt ?? e.createdAt ?? Date.now()).getTime();
      return Number.isFinite(t) && t < min ? t : min;
    }, Date.now());
    const res = await getTransactions(
      userId,
      {
        from: new Date(earliest - 3600_000).toISOString(),
        to: new Date().toISOString(),
        type: 'TRADE',
      },
      env
    );
    txCache = res.ok ? (res.data?.transactions ?? []) : [];
    return txCache;
  };

  for (const exec of execs) {
    summary.checked += 1;
    try {
      if (exec.status === 'submitted') {
        await reconcileSubmitted(exec, userId, env, summary);
      } else if (exec.status === 'pending') {
        await reconcilePending(exec, workingOrders, positions, summary);
      } else if (exec.status === 'open' || exec.status === 'closed') {
        // 'closed' only reaches here when realizedPnl is null (retry
        // window above) — reconcileOpen re-checks history and backfills.
        await reconcileOpen(exec, positions, getHistory, getTxnHistory, summary);
      }
    } catch (e) {
      summary.errors += 1;
      console.error(
        `[trade-monitor] exec ${String(exec._id)} reconcile error:`, e
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* submitted -> re-poll /confirms                                      */
/* ------------------------------------------------------------------ */
async function reconcileSubmitted(
  exec: ExecDoc,
  userId: string,
  env: 'demo' | 'live',
  summary: MonitorSummary
) {
  if (!exec.dealReference) {
    await markFailed(exec, 'missing_deal_reference', summary);
    return;
  }
  const conf = await confirmPosition(userId, exec.dealReference, env);
  const c = conf.data?.dealConfirmation ?? conf.data?.workingOrderConfirmation;
  const status = c?.dealStatus;
  const deals = c?.affectedDeals ?? [];
  const wo = c?.workingOrder;

  if (status === 'ACCEPTED' || deals.length > 0 || wo) {
    const dealId =
      deals[0]?.dealId ?? wo?.workingOrderId ?? wo?.dealId ?? exec.dealId;
    // A confirmed working order rests as 'pending', a position as 'open'.
    // ExecDoc doesn't declare orderType — read it tolerantly.
    const execType = (exec as { orderType?: string }).orderType;
    const resting =
      !!wo || execType === 'LIMIT' || execType === 'STOP';
    await markState(exec, resting ? 'pending' : 'open', {
      dealId,
      openedAt: resting ? undefined : new Date(),
      confirmedAt: new Date(),
      error: null,
    });
    if (resting) summary.unchanged += 1;
    else summary.opened += 1;
    await syncEvaluation(exec, resting ? 'trade_pending' : 'trade_open');
    return;
  }
  if (status === 'REJECTED' || status === 'FAILED') {
    await markFailed(exec, `confirm_${String(status).toLowerCase()}`, summary);
    return;
  }
  summary.unchanged += 1;
}

/* ------------------------------------------------------------------ */
/* pending (resting working order) -> filled or cancelled              */
/* ------------------------------------------------------------------ */
async function reconcilePending(
  exec: ExecDoc,
  workingOrders: WorkingOrderEntry[],
  positions: CapitalPositionEntry[],
  summary: MonitorSummary
) {
  const stillResting =
    exec.dealId &&
    workingOrders.some((o) => workingOrderIds(o).includes(exec.dealId!));

  if (stillResting) {
    summary.unchanged += 1;
    return;
  }

  // Order left the working-orders list — did it fill into a position?
  const fill = positions.find((p) => {
    if (positionEpic(p) !== (exec.epic || '').toUpperCase()) return false;
    if (positionDirection(p) !== exec.direction) return false;
    const lvl = positionLevel(p);
    if (exec.entryLevel != null && lvl != null) {
      return Math.abs(lvl - exec.entryLevel) < 1;
    }
    return true;
  });

  if (fill) {
    await markState(exec, 'open', {
      dealId: positionDealId(fill) ?? exec.dealId,
      openedAt: positionOpenedAt(fill) ?? new Date(),
      confirmedAt: exec.confirmedAt ?? new Date(),
      error: null,
    });
    summary.opened += 1;
    await syncEvaluation(exec, 'trade_open');
    return;
  }

  // Gone with no matching position — cancelled, rejected, or expired.
  await markState(exec, 'cancelled', {
    error: 'working_order_removed',
  });
  summary.cancelled += 1;
  await syncEvaluation(exec, 'trade_cancelled');
}

/* ------------------------------------------------------------------ */
/* open -> still open, or closed with realized P/L                     */
/* ------------------------------------------------------------------ */
async function reconcileOpen(
  exec: ExecDoc,
  positions: CapitalPositionEntry[],
  getHistory: () => Promise<CapitalActivity[]>,
  getTransactions: () => Promise<CapitalTransaction[]>,
  summary: MonitorSummary
) {
  const openPos = positions.find(
    (p) => positionDealId(p) === exec.dealId
  );
  if (openPos) {
    // Refresh live unrealized P/L every tick while the trade is open.
    const upl = asRecord(openPos.position).upl ?? asRecord(openPos.position).profitLoss;
    await TradeExecution.updateOne(
      { _id: exec._id },
      { $set: { unrealizedPnl: typeof upl === 'number' ? upl : null } }
    );
    // Keep the evaluation's lifecycle fields converged (also heals docs
    // written before orderType mirroring existed).
    await syncEvaluation(exec, 'trade_open');
    summary.unchanged += 1;
    return;
  }

  // Position is gone — it closed. Realized P/L comes from
  // /history/transactions (TRADE entries carry 'pnl'); activity history
  // is the fallback for the close timestamp.
  const [txns, history] = await Promise.all([getTransactions(), getHistory()]);
  const closeTxn = txns
    .filter((t) => transactionMatchesExec(t, exec))
    .sort((x, y) => transactionTime(y) - transactionTime(x))[0];

  const candidates = history
    .filter((a) => activityMatchesExec(a, exec))
    .sort((x, y) => activityTime(y) - activityTime(x));
  const close =
    candidates.find(
      (a) => typeof a.profit === 'number' || typeof a.profitLoss === 'number'
    ) ??
    candidates[0] ??
    null;

  // Capital.com puts realized P/L on TRADE-close transactions; observed
  // field priority: pnl -> cash -> size (size = P/L amount, NOT units —
  // verified: position size 0.09 produced transaction size "0.28" = +$0.28).
  const txnPnl = closeTxn
    ? toNumber(closeTxn.pnl) ?? toNumber(closeTxn.cash) ?? toNumber(closeTxn.size)
    : null;
  const pnl = txnPnl ?? close?.profit ?? close?.profitLoss ?? null;

  // Exit price: prefer an explicit close-source activity (CLOSE_OUT /
  // SL / TP), else the latest POSITION activity — its level is the
  // price the position closed at.
  const exitActivity =
    candidates.find((a) =>
      ['CLOSE_OUT', 'SL', 'TP'].includes(String(a.source ?? '').toUpperCase())
    ) ??
    candidates.find((a) => String(a.type ?? '').toUpperCase() === 'POSITION') ??
    close;
  const exitLevel = exitActivity ? activityLevel(exitActivity) : null;

  // Diagnostics: a close with no P/L means the transaction didn't match
  // or the field name differs — log what the broker actually returned.
  if (pnl == null) {
    console.warn(
      `[trade-monitor] no pnl for exec ${String(exec._id)} deal=${exec.dealId} ` +
        `txns=${txns.length} matchedTxn=${closeTxn ? JSON.stringify(closeTxn).slice(0, 600) : 'none'} ` +
        `sample=${JSON.stringify(txns.slice(0, 2)).slice(0, 600)}`
    );
  }

  const closedAtRaw =
    (closeTxn?.dateUtc ?? closeTxn?.dateUTC ?? closeTxn?.date) ??
    (close?.closedDate as string | undefined) ??
    close?.dateUTC ??
    close?.date ??
    close?.createdDateUTC ??
    close?.createdDate;
  const parsed =
    typeof closedAtRaw === 'string' || typeof closedAtRaw === 'number'
      ? new Date(closedAtRaw)
      : new Date();
  const closedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  await markState(exec, 'closed', {
    realizedPnl: typeof pnl === 'number' ? pnl : null,
    unrealizedPnl: null,
    exitLevel,
    closedAt,
    error: null,
  });
  summary.closed += 1;
  await syncEvaluation(exec, 'trade_closed');
}

/* ------------------------------------------------------------------ */
/* DB writers                                                          */
/* ------------------------------------------------------------------ */
async function markState(
  exec: ExecDoc,
  status: string,
  fields: {
    dealId?: string | null;
    openedAt?: Date;
    confirmedAt?: Date;
    realizedPnl?: number | null;
    unrealizedPnl?: number | null;
    exitLevel?: number | null;
    closedAt?: Date;
    error?: string | null;
  }
) {
  const $set: Record<string, unknown> = { status };
  if (fields.dealId !== undefined) $set.dealId = fields.dealId;
  if (fields.openedAt) $set.openedAt = fields.openedAt;
  if (fields.confirmedAt) $set.confirmedAt = fields.confirmedAt;
  if (fields.realizedPnl !== undefined) $set.realizedPnl = fields.realizedPnl;
  if (fields.unrealizedPnl !== undefined) $set.unrealizedPnl = fields.unrealizedPnl;
  if (fields.exitLevel !== undefined) $set.exitLevel = fields.exitLevel;
  if (fields.closedAt) $set.closedAt = fields.closedAt;
  if (fields.error !== undefined) $set.error = fields.error;
  await TradeExecution.updateOne({ _id: exec._id }, { $set });
}

async function markFailed(exec: ExecDoc, reason: string, summary: MonitorSummary) {
  await markState(exec, 'failed', { error: reason });
  summary.failed += 1;
  await syncEvaluation(exec, 'trade_failed');
}

/** Mirror the lifecycle onto the linked SIGNAL_EVALUATIONS doc. */
async function syncEvaluation(exec: ExecDoc, stage: string) {
  try {
    // orderType on the evaluation mirrors the TRADE state going forward
    // (PENDING -> OPEN -> CLOSED); the signal's original order_type stays
    // preserved on the signals doc via signalRefId.
    const orderType =
      stage === 'trade_open' ? 'OPEN'
      : stage === 'trade_closed' ? 'CLOSED'
      : stage === 'trade_pending' ? 'PENDING'
      : stage === 'trade_failed' ? 'FAILED'
      : stage === 'trade_cancelled' ? 'CANCELLED'
      : null;
    await SignalEvaluation.updateMany(
      { executionId: exec._id },
      {
        $set: {
          stage,
          reason: null,
          evaluatedAt: new Date(),
          ...(orderType ? { orderType } : {}),
        },
      }
    );
  } catch (e) {
    console.error('[trade-monitor] evaluation sync failed:', e);
  }
}
