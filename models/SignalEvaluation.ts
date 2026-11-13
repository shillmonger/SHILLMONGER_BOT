import mongoose, { Schema, Document, Model } from 'mongoose';

export type EvaluationStage =
  | 'bot_config'
  | 'broker'
  | 'instrument'
  | 'rules'
  | 'position_limit'
  | 'session'
  | 'instrument_resolution'
  | 'sizing'
  | 'pending_order_check'
  | 'order_submit'
  | 'confirmed'
  | 'eligible';

/**
 * Per-signal, per-user eligibility audit record.
 *
 * For every Telegram signal the engine evaluates EVERY armed user and
 * stores one document here describing the outcome:
 *   - eligible=true  -> the user passed all checks and an order was
 *                      attempted; `executionId` links to the
 *                      TradeExecution record for that attempt.
 *   - eligible=false -> `stage` + `reason` explain which gate stopped it
 *                      (bot off, broker disconnected, balance tier had no
 *                      rule, pending order already resting, etc.).
 *
 * One document per (signal, user) — enforced by the unique index, so
 * re-delivered signals can never double-count an evaluation.
 */
export interface ISignalEvaluation extends Document {
  signalChatId: number;
  signalMessageId: number;
  /** Ingest-side signal document id (signals collection _id), when known */
  signalRefId?: string;
  userId: mongoose.Types.ObjectId;
  environment: 'demo' | 'live';
  symbol: string;
  direction: string;
  groupName?: string;
  orderType?: string;
  eligible: boolean;
  stage: EvaluationStage | string;
  reason?: string;
  executionId?: mongoose.Types.ObjectId;
  evaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SignalEvaluationSchema: Schema = new Schema(
  {
    signalChatId: { type: Number, required: true },
    signalMessageId: { type: Number, required: true },
    signalRefId: { type: String, default: null },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    environment: {
      type: String,
      enum: ['demo', 'live'],
      required: true,
    },
    symbol: { type: String, default: '' },
    direction: { type: String, default: '' },
    groupName: { type: String, default: null },
    orderType: { type: String, default: null },
    eligible: { type: Boolean, required: true },
    stage: { type: String, required: true },
    reason: { type: String, default: null },
    executionId: {
      type: Schema.Types.ObjectId,
      ref: 'TradeExecution',
      default: null,
    },
    evaluatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'SIGNAL_EVALUATIONS',
  }
);

// One evaluation per user per Telegram signal — prevents duplicate rows
// when the worker redelivers a signal.
SignalEvaluationSchema.index(
  { signalChatId: 1, signalMessageId: 1, userId: 1 },
  { unique: true, name: 'signal_eval_dedup' }
);
SignalEvaluationSchema.index({ userId: 1, createdAt: -1 });
SignalEvaluationSchema.index({ signalChatId: 1, signalMessageId: 1 });

const SignalEvaluation: Model<ISignalEvaluation> =
  mongoose.models.SignalEvaluation ||
  mongoose.model<ISignalEvaluation>('SignalEvaluation', SignalEvaluationSchema);

export default SignalEvaluation;
