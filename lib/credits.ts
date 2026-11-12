/**
 * Credit-ledger service — READINESS ONLY.
 *
 * Business rule (future): a qualifying profitable trading day consumes
 * one credit. This module only records candidate days into CREDIT_LEDGER
 * with a unique idempotency key so a day can never be deducted twice.
 *
 * NOTHING here deducts credits. Only confirmed, broker-verified results
 * should ever mark a record 'qualified'/'deducted' — and even that is a
 * manual/admin decision for now.
 */

import connectDB from '@/lib/db';
import CreditLedger from '@/models/CreditLedger';

/**
 * Record (or refresh) the candidate credit record for a trading day.
 * Idempotent: the unique idempotencyKey makes repeat calls safe.
 * Status stays 'pending_review' — never 'deducted' automatically.
 */
export async function recordTradingDay(args: {
  userId: string;
  tradingDate: string; // YYYY-MM-DD UTC
  environment: 'demo' | 'live';
  netRealizedProfit: number;
}): Promise<{ recorded: boolean; reason?: string }> {
  try {
    await connectDB();
    const idempotencyKey = `${args.userId}:${args.tradingDate}:${args.environment}`;

    const existing = await CreditLedger.findOne({ idempotencyKey });
    if (existing) {
      return { recorded: false, reason: 'already_recorded' };
    }

    await CreditLedger.create({
      userId: args.userId,
      tradingDate: args.tradingDate,
      environment: args.environment,
      netRealizedProfit: args.netRealizedProfit,
      status: 'pending_review',
      idempotencyKey,
      notes: 'Auto-recorded candidate; deduction not yet enabled',
    });
    return { recorded: true };
  } catch (e) {
    // Duplicate key race -> treat as already recorded.
    if (
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: number }).code === 11000
    ) {
      return { recorded: false, reason: 'already_recorded' };
    }
    console.error('[credits] failed to record trading day:', e);
    return { recorded: false, reason: 'error' };
  }
}
