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
  confirmPosition,
  type CapitalActivity,
  type CapitalPositionEntry,
  type CapitalWorkingOrder,
} from '@/lib/capitalcom';

const NON_TERMINAL = ['pending', 'submitted', 'open'] as const;
const HISTORY_WINDOW_DAYS = 90;

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
  const execs = (await TradeExecution.find({
    status: { $in: [...NON_TERMINAL] },
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
  let historyCache: CapitalActivity[] | null = null;
  const getHistory = async (): Promise<CapitalActivity[]> => {
    if (historyCache) return historyCache;
    const from = new Date(
      Date.now() - HISTORY_WINDOW_DAYS * 86400_000
    ).toISOString();
    const res = await getHistoryActivity(
      userId,
      { from, to: new Date().toISOString() },
      env
    );
    historyCache = res.ok ? flattenActivities(res.data?.activities) : [];
    return historyCache;
  };

  for (const exec of execs) {
    summary.checked += 1;
    try {
      if (exec.status === 'submitted') {
        await reconcileSubmitted(exec, userId, env, summary);
      } else if (exec.status === 'pending') {
        await reconcilePending(exec, workingOrders, positions, summary);
      } else if (exec.status === 'open') {
        await reconcileOpen(exec, positions, getHistory, summary);
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
  summary: MonitorSummary
) {
  const stillOpen = positions.some(
    (p) => positionDealId(p) === exec.dealId
  );
  if (stillOpen) {
    summary.unchanged += 1;
    return;
  }

  // Position is gone — find the closing activity for realized P/L.
  const history = await getHistory();
  const close = history.find(
    (a) => String(a.dealId ?? '') === String(exec.dealId ?? '')
  );
  const pnl = close?.profit ?? close?.profitLoss;
  const closedAtRaw =
    close?.closedDate ?? close?.createdDateUTC ?? close?.createdDate;
  const parsed =
    typeof closedAtRaw === 'string' ? new Date(closedAtRaw) : new Date();
  const closedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  await markState(exec, 'closed', {
    realizedPnl: typeof pnl === 'number' ? pnl : null,
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
    closedAt?: Date;
    error?: string | null;
  }
) {
  const $set: Record<string, unknown> = { status };
  if (fields.dealId !== undefined) $set.dealId = fields.dealId;
  if (fields.openedAt) $set.openedAt = fields.openedAt;
  if (fields.confirmedAt) $set.confirmedAt = fields.confirmedAt;
  if (fields.realizedPnl !== undefined) $set.realizedPnl = fields.realizedPnl;
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
    await SignalEvaluation.updateMany(
      { executionId: exec._id },
      { $set: { stage, reason: null, evaluatedAt: new Date() } }
    );
  } catch (e) {
    console.error('[trade-monitor] evaluation sync failed:', e);
  }
}
