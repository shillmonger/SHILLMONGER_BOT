import mongoose, { Schema, Document, Model } from 'mongoose';

export type CreditDeductionStatus =
  | 'pending_review'
  | 'qualified'
  | 'not_qualified'
  | 'deducted';

/**
 * Credit-ledger readiness record.
 *
 * Business rule (not yet enforced): a qualifying profitable trading day
 * consumes one credit. This collection only RECORDS candidate days with
 * an idempotency key so a day can never be deducted twice. No code path
 * currently performs an actual deduction — only confirmed, verified
 * broker results should ever set status to 'deducted'.
 */
export interface ICreditLedger extends Document {
  userId: mongoose.Types.ObjectId;
  /** Trading day in YYYY-MM-DD (UTC) */
  tradingDate: string;
  environment: 'demo' | 'live';
  netRealizedProfit: number;
  status: CreditDeductionStatus;
  /** Unique key e.g. "userId:YYYY-MM-DD:env" — prevents double deduction */
  idempotencyKey: string;
  transactionRef?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CreditLedgerSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tradingDate: { type: String, required: true },
    environment: {
      type: String,
      enum: ['demo', 'live'],
      required: true,
    },
    netRealizedProfit: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending_review', 'qualified', 'not_qualified', 'deducted'],
      default: 'pending_review',
    },
    idempotencyKey: { type: String, required: true },
    transactionRef: { type: String, default: null },
    notes: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'CREDIT_LEDGER',
  }
);

CreditLedgerSchema.index({ idempotencyKey: 1 }, { unique: true });
CreditLedgerSchema.index({ userId: 1, tradingDate: 1 });

const CreditLedger: Model<ICreditLedger> =
  mongoose.models.CreditLedger ||
  mongoose.model<ICreditLedger>('CreditLedger', CreditLedgerSchema);

export default CreditLedger;
