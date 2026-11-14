export type RecommendationType = "KEEP" | "MONITOR" | "REVIEW" | "CONSIDER LEAVING";
export type TrendDirection = "IMPROVING" | "DETERIORATING" | "STABLE";

export interface GroupAnalytics {
  id: string;
  name: string;
  username: string | null;
  tgId: string;
  membersCount: number;
  addedAt: string;
  status: string;
  recommendation: RecommendationType;
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
    side: "BUY" | "SELL";
    status: string;
    signalId: string;
    fees: number;
    netPnl: number;
  }[];
}

export async function fetchGroupAnalytics(period: string): Promise<GroupAnalytics[]> {
  const res = await fetch(`/api/admin/group-rankings?period=${encodeURIComponent(period)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load group rankings (${res.status})`);
  const json = await res.json();
  return (json.groups ?? []) as GroupAnalytics[];
}
