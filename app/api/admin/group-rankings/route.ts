import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-helper';
import TelegramProvider from '@/models/TelegramProvider';
import TradeExecution from '@/models/TradeExecution';

/**
 * GET /api/admin/group-rankings?period=today|yesterday|7d|30d|90d|this_month|last_month|all
 *
 * Aggregates TRADE_EXECUTIONS + signals + telegramproviders per Telegram
 * group (signal source) across ALL users, returning the full
 * GroupAnalytics shape consumed by /AdminDashboard/group-rankings.
 *
 * Group identity: executions carry chatId + groupName; providers carry
 * groupId + groupName. chatId values are normalized to strings for joins
 * (Mongo stores them as doubles, providers as strings).
 */

type ExecLean = {
  _id?: unknown;
  chatId?: number | null;
  messageId?: number | null;
  groupName?: string | null;
  symbol?: string | null;
  direction?: string | null;
  status?: string | null;
  realizedPnl?: number | null;
  unrealizedPnl?: number | null;
  size?: number | null;
  entryLevel?: number | null;
  openedAt?: Date | null;
  closedAt?: Date | null;
  createdAt?: Date;
};

type SignalDoc = {
  chat_id?: unknown;
  message_id?: unknown;
  ingested_at?: Date;
};

export type Recommendation = 'KEEP' | 'MONITOR' | 'REVIEW' | 'CONSIDER LEAVING';
export type TrendDirection = 'IMPROVING' | 'DETERIORATING' | 'STABLE';

export interface GroupAnalytics {
  id: string;
  name: string;
  username: string | null;
  tgId: string;
  membersCount: number;
  addedAt: string;
  status: string;
  recommendation: Recommendation;
  recommendationReasons: string[];
  trendDirection: TrendDirection;
  totalSignals: number;
  signalStats: {
    totalReceived: number;
    processed: number;
    executed: number;
    ignoredOrRejected: number;
    failedExecution: number;
    invalid: number;
    duplicates: number;
    expiredOrMissed: number;
    conversionRate: number;
    avgLatencySec: number;
    signalAccuracy: number;
  };
  totalExecuted: number;
  openTradesCount: number;
  pendingTradesCount: number;
  unrealizedPnl: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  totalFees: number;
  netPnlAfterFees: number;
  roi: number;
  profitFactor: number;
  consistencyScore: number;
  allocatedCapital: number;
  totalVolume: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgDurationMin: number;
  maxWinStreak: number;
  maxLossStreak: number;
  bestTradingDay: { date: string; pnl: number };
  worstTradingDay: { date: string; pnl: number };
  pairBreakdown: { symbol: string; trades: number; winRate: number; netPnl: number }[];
  equityCurve: number[];
  recentTrades: {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    status: string;
    signalId: string;
    fees: number;
    netPnl: number;
  }[];
}

/** Normalize a Telegram chat id (number or numeric string) for joins. */
function chatKey(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n)) return String(Math.trunc(n));
  return s;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function periodRange(period: string): { from?: Date; to?: Date } {
  const now = new Date();
  const today = startOfDay(now);
  switch (period) {
    case 'today':
      return { from: today };
    case 'yesterday': {
      const y = new Date(today.getTime() - 86400_000);
      return { from: y, to: today };
    }
    case '7d':
      return { from: new Date(now.getTime() - 7 * 86400_000) };
    case '90d':
      return { from: new Date(now.getTime() - 90 * 86400_000) };
    case 'this_month':
      return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) };
    case 'last_month': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return { from, to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) };
    }
    case 'all':
      return {};
    case '30d':
    default:
      return { from: new Date(now.getTime() - 30 * 86400_000) };
  }
}

function recommend(args: {
  executed: number; decided: number; winRate: number; netPnl: number;
  profitFactor: number; consistency: number;
}): { recommendation: Recommendation; reasons: string[] } {
  const reasons: string[] = [];
  const { executed, decided, winRate, netPnl, profitFactor, consistency } = args;

  if (executed < 10 || decided < 5) {
    reasons.push('Limited completed trade history — not enough data for a confident verdict.');
    return { recommendation: 'MONITOR', reasons };
  }
  if (netPnl > 0 && winRate >= 50 && profitFactor >= 1.2) {
    reasons.push(`Net profit ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} with ${winRate}% win rate and profit factor ${profitFactor.toFixed(2)}.`);
    if (consistency >= 60) reasons.push(`Consistent daily results (${consistency}% green days).`);
    return { recommendation: 'KEEP', reasons };
  }
  if (netPnl < 0 && (winRate < 45 || profitFactor < 0.75)) {
    reasons.push(`Net loss ${netPnl.toFixed(2)} — win rate ${winRate}% and profit factor ${profitFactor.toFixed(2)} are both weak.`);
    reasons.push('Signal quality does not justify the drawdown in this period.');
    return { recommendation: 'CONSIDER LEAVING', reasons };
  }
  if (netPnl < 0) {
    reasons.push(`Net loss ${netPnl.toFixed(2)} in the period — profitable setups exist but are outweighed by losers.`);
    reasons.push('Review whether recent signals are deteriorating before deciding.');
    return { recommendation: 'REVIEW', reasons };
  }
  reasons.push('Results are mixed — roughly break-even after costs.');
  reasons.push('Keep monitoring before committing more capital.');
  return { recommendation: 'MONITOR', reasons };
}

export async function GET(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? '30d';
    const range = periodRange(period);
    const rangeMatch: Record<string, unknown> = {};
    if (range.from || range.to) {
      rangeMatch.createdAt = {
        ...(range.from ? { $gte: range.from } : {}),
        ...(range.to ? { $lt: range.to } : {}),
      };
    }
    const signalRangeMatch: Record<string, unknown> = {};
    if (range.from || range.to) {
      signalRangeMatch.ingested_at = {
        ...(range.from ? { $gte: range.from } : {}),
        ...(range.to ? { $lt: range.to } : {}),
      };
    }

    const [providers, execs, signalDocs] = await Promise.all([
      TelegramProvider.find({}).lean(),
      TradeExecution.find(rangeMatch, {
        chatId: 1, messageId: 1, groupName: 1, symbol: 1, direction: 1,
        status: 1, realizedPnl: 1, unrealizedPnl: 1, size: 1, entryLevel: 1,
        openedAt: 1, closedAt: 1, createdAt: 1,
      }).lean() as unknown as Promise<ExecLean[]>,
      db.collection('signals').find(signalRangeMatch, {
        projection: { chat_id: 1, message_id: 1, ingested_at: 1 },
      }).toArray() as unknown as Promise<SignalDoc[]>,
    ]);

    /* ── Signal lookups ────────────────────────────────────────── */
    const signalCountByChat = new Map<string, number>();
    const signalIngestByKey = new Map<string, number>(); // chat|msg -> ingest ms
    for (const s of signalDocs) {
      const ck = chatKey(s.chat_id);
      if (!ck) continue;
      signalCountByChat.set(ck, (signalCountByChat.get(ck) ?? 0) + 1);
      const mk = chatKey(s.message_id);
      if (mk && s.ingested_at) {
        const t = new Date(s.ingested_at).getTime();
        if (Number.isFinite(t)) signalIngestByKey.set(`${ck}|${mk}`, t);
      }
    }

    /* ── Provider metadata ─────────────────────────────────────── */
    const providerByKey = new Map<string, (typeof providers)[number]>();
    for (const p of providers) {
      const k = chatKey(p.groupId) ?? chatKey(p.groupName);
      if (k) providerByKey.set(k, p);
    }

    /* ── Group executions ──────────────────────────────────────── */
    interface Acc {
      execs: ExecLean[];
      name: string | null;
      signalKeys: Set<string>;
      latencySum: number;
      latencyN: number;
    }
    const byGroup = new Map<string, Acc>();
    const BAD = new Set(['failed', 'cancelled', 'rejected']);

    for (const e of execs) {
      const key = chatKey(e.chatId);
      if (!key) continue;
      const acc = byGroup.get(key) ?? { execs: [], name: null, signalKeys: new Set(), latencySum: 0, latencyN: 0 };
      acc.execs.push(e);
      if (!acc.name && e.groupName) acc.name = e.groupName;
      if (e.messageId != null) {
        const sk = `${key}|${chatKey(e.messageId)}`;
        acc.signalKeys.add(sk);
        const ingested = signalIngestByKey.get(sk);
        const execAt = new Date(e.createdAt ?? 0).getTime();
        if (ingested && Number.isFinite(execAt) && execAt >= ingested) {
          acc.latencySum += (execAt - ingested) / 1000;
          acc.latencyN += 1;
        }
      }
      byGroup.set(key, acc);
    }

    /* ── Build rows ────────────────────────────────────────────── */
    const rows: GroupAnalytics[] = [];
    const allKeys = new Set<string>([
      ...byGroup.keys(),
      ...providerByKey.keys(),
      ...signalCountByChat.keys(),
    ]);

    for (const key of allKeys) {
      const acc = byGroup.get(key);
      const prov = providerByKey.get(key);
      const list = acc?.execs ?? [];

      const closed = list
        .filter((e) => e.status === 'closed' && typeof e.realizedPnl === 'number')
        .sort((a, b) => new Date(a.closedAt ?? 0).getTime() - new Date(b.closedAt ?? 0).getTime());

      const winsArr = closed.filter((e) => (e.realizedPnl ?? 0) > 0);
      const lossesArr = closed.filter((e) => (e.realizedPnl ?? 0) < 0);
      const breakeven = closed.length - winsArr.length - lossesArr.length;

      const grossProfit = winsArr.reduce((s, e) => s + (e.realizedPnl ?? 0), 0);
      const grossLossMag = Math.abs(lossesArr.reduce((s, e) => s + (e.realizedPnl ?? 0), 0));
      const netPnl = closed.reduce((s, e) => s + (e.realizedPnl ?? 0), 0);

      const notional = closed.reduce(
        (s, e) => s + Math.abs((e.size ?? 0) * (e.entryLevel ?? 0)), 0
      );
      const totalVolume = closed.reduce((s, e) => s + Math.abs(e.size ?? 0), 0);
      const roi = notional > 0 ? (netPnl / notional) * 100 : 0;
      const profitFactor = grossLossMag > 0 ? grossProfit / grossLossMag : grossProfit > 0 ? 99 : 0;

      const winRate = closed.length
        ? Math.round((winsArr.length / closed.length) * 100)
        : 0;
      const avgWin = winsArr.length ? grossProfit / winsArr.length : 0;
      const avgLoss = lossesArr.length ? grossLossMag / lossesArr.length : 0;
      const largestWin = winsArr.length ? Math.max(...winsArr.map((e) => e.realizedPnl ?? 0)) : 0;
      const largestLoss = lossesArr.length ? Math.abs(Math.min(...lossesArr.map((e) => e.realizedPnl ?? 0))) : 0;

      // Streaks (longest W/L run + current run) over closed trades.
      let cur: 'W' | 'L' | null = null;
      let run = 0;
      let maxWin = 0;
      let maxLoss = 0;
      for (const e of closed) {
        const pnl = e.realizedPnl ?? 0;
        const outcome = pnl > 0 ? 'W' : pnl < 0 ? 'L' : null;
        if (outcome === cur && outcome) run += 1;
        else { cur = outcome; run = outcome ? 1 : 0; }
        if (outcome === 'W') maxWin = Math.max(maxWin, run);
        if (outcome === 'L') maxLoss = Math.max(maxLoss, run);
      }

      const durations = closed
        .map((e) => {
          if (!e.openedAt || !e.closedAt) return null;
          const ms = new Date(e.closedAt).getTime() - new Date(e.openedAt).getTime();
          return ms > 0 ? ms / 60000 : null;
        })
        .filter((v): v is number => v != null);
      const avgDurationMin = durations.length
        ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length)
        : 0;

      // Daily P/L → best/worst day, consistency, trend.
      const daily = new Map<string, number>();
      for (const e of closed) {
        const d = new Date(e.closedAt ?? 0).toISOString().slice(0, 10);
        daily.set(d, (daily.get(d) ?? 0) + (e.realizedPnl ?? 0));
      }
      const dayEntries = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const bestDay = dayEntries.reduce((a, b) => (b[1] > a[1] ? b : a), dayEntries[0] ?? ['', 0]);
      const worstDay = dayEntries.reduce((a, b) => (b[1] < a[1] ? b : a), dayEntries[0] ?? ['', 0]);
      const greenDays = dayEntries.filter(([, v]) => v > 0).length;
      const consistencyScore = dayEntries.length
        ? Math.round((greenDays / dayEntries.length) * 100)
        : 0;

      // Trend: compare net P/L of second half vs first half of the period's
      // closed trades (by close time).
      let trendDirection: TrendDirection = 'STABLE';
      if (closed.length >= 4) {
        const mid = Math.floor(closed.length / 2);
        const firstHalf = closed.slice(0, mid).reduce((s, e) => s + (e.realizedPnl ?? 0), 0);
        const secondHalf = closed.slice(mid).reduce((s, e) => s + (e.realizedPnl ?? 0), 0);
        if (secondHalf > firstHalf * 1.1 && secondHalf > 0) trendDirection = 'IMPROVING';
        else if (secondHalf < firstHalf * 0.9) trendDirection = 'DETERIORATING';
      }

      // Pair breakdown (symbol) — executions carry the raw Telegram symbol.
      const pairMap = new Map<string, { trades: number; wins: number; net: number }>();
      for (const e of closed) {
        const sym = e.symbol || e.groupName || 'UNKNOWN';
        const p = pairMap.get(sym) ?? { trades: 0, wins: 0, net: 0 };
        p.trades += 1;
        if ((e.realizedPnl ?? 0) > 0) p.wins += 1;
        p.net += e.realizedPnl ?? 0;
        pairMap.set(sym, p);
      }
      const pairBreakdown = [...pairMap.entries()]
        .map(([symbol, p]) => ({
          symbol,
          trades: p.trades,
          winRate: p.trades ? Math.round((p.wins / p.trades) * 100) : 0,
          netPnl: p.net,
        }))
        .sort((a, b) => b.netPnl - a.netPnl)
        .slice(0, 6);

      // Real cumulative realized P/L over closed trades, resampled to 30 pts.
      const cum: number[] = [];
      let cumRun = 0;
      for (const e of closed) {
        cumRun += e.realizedPnl ?? 0;
        cum.push(Number(cumRun.toFixed(2)));
      }
      const equityCurve = Array.from({ length: 30 }, (_, i) => {
        if (cum.length === 0) return 0;
        const idx = Math.min(cum.length - 1, Math.round((i / 29) * (cum.length - 1)));
        return cum[idx];
      });

      // Recent trades (latest 8 by activity time).
      const recentTrades = [...list]
        .sort(
          (a, b) =>
            new Date(b.closedAt ?? b.createdAt ?? 0).getTime() -
            new Date(a.closedAt ?? a.createdAt ?? 0).getTime()
        )
        .slice(0, 8)
        .map((e) => ({
          id: String(e._id ?? ''),
          symbol: e.symbol || 'GOLD',
          side: (e.direction === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
          status: (e.status ?? 'unknown').toUpperCase(),
          signalId: e.messageId != null ? String(e.messageId) : '',
          fees: 0,
          netPnl: e.status === 'closed' ? (e.realizedPnl ?? 0) : (e.unrealizedPnl ?? 0),
        }));

      const totalSignals = signalCountByChat.get(key) ?? 0;
      const uniqueSignals = acc?.signalKeys.size ?? 0;
      const executed = list.filter((e) => !BAD.has(e.status ?? '')).length;
      const failedExec = list.filter((e) => BAD.has(e.status ?? '')).length;
      const openTradesCount = list.filter((e) => e.status === 'open').length;
      const pendingTradesCount = list.filter((e) => e.status === 'pending' || e.status === 'submitted').length;
      const unrealizedPnl = list
        .filter((e) => e.status === 'open')
        .reduce((s, e) => s + (e.unrealizedPnl ?? 0), 0);

      const conversionRate = totalSignals > 0 ? Math.round((uniqueSignals / totalSignals) * 100) : 0;
      const signalAccuracy = closed.length
        ? Math.round((winsArr.length / closed.length) * 100)
        : 0;
      const decided = winsArr.length + lossesArr.length;

      const { recommendation, reasons } = recommend({
        executed, decided, winRate, netPnl, profitFactor, consistency: consistencyScore,
      });

      rows.push({
        id: key,
        name: prov?.groupName ?? acc?.name ?? `Group ${key}`,
        username: null,
        tgId: prov?.groupId ?? key,
        membersCount: 0,
        addedAt: prov?.createdAt ? new Date(prov.createdAt).toISOString().slice(0, 10) : '—',
        status: prov ? (prov.isActive ? 'ACTIVE' : 'PAUSED') : 'UNREGISTERED',
        recommendation,
        recommendationReasons: reasons,
        trendDirection,
        totalSignals,
        signalStats: {
          totalReceived: totalSignals,
          processed: totalSignals,
          executed: uniqueSignals,
          ignoredOrRejected: 0,
          failedExecution: failedExec,
          invalid: 0,
          duplicates: 0,
          expiredOrMissed: 0,
          conversionRate,
          avgLatencySec: acc?.latencyN ? Math.round(acc.latencySum / acc.latencyN) : 0,
          signalAccuracy,
        },
        totalExecuted: executed,
        openTradesCount,
        pendingTradesCount,
        unrealizedPnl,
        wins: winsArr.length,
        losses: lossesArr.length,
        breakeven,
        winRate,
        grossProfit,
        grossLoss: grossLossMag,
        totalFees: 0,
        netPnlAfterFees: netPnl,
        roi,
        profitFactor: Number(profitFactor.toFixed(2)),
        consistencyScore,
        allocatedCapital: notional,
        totalVolume: Number(totalVolume.toFixed(2)),
        avgWin: Number(avgWin.toFixed(2)),
        avgLoss: Number(avgLoss.toFixed(2)),
        largestWin: Number(largestWin.toFixed(2)),
        largestLoss: Number(largestLoss.toFixed(2)),
        avgDurationMin,
        maxWinStreak: maxWin,
        maxLossStreak: maxLoss,
        bestTradingDay: { date: bestDay[0] || '—', pnl: Number(bestDay[1].toFixed(2)) },
        worstTradingDay: { date: worstDay[0] || '—', pnl: Number(worstDay[1].toFixed(2)) },
        pairBreakdown,
        equityCurve,
        recentTrades,
      });
    }

    rows.sort((a, b) => b.netPnlAfterFees - a.netPnlAfterFees);

    return NextResponse.json({ success: true, period, groups: rows });
  } catch (error) {
    console.error('Admin group-rankings GET error:', error);
    return NextResponse.json({ error: 'Failed to compute group rankings' }, { status: 500 });
  }
}
