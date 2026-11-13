import mongoose, { Schema, Document, Model } from 'mongoose';

export type TradeExecutionStatus =
  | 'pending'
  | 'submitted'
  | 'open'
  | 'rejected'
  | 'failed'
  | 'closed'
  | 'cancelled';

export type TradeDirection = 'BUY' | 'SELL';
export type TradeEnvironment = 'demo' | 'live';

/**
 * Record of a trade execution attempt against the operator's own
 * Capital.com account. A trade is only 'open' after the broker's
 * /confirms/{dealReference} endpoint confirms it — never on submit alone.
 */
export interface ITradeExecution extends Document {
  userId: mongoose.Types.ObjectId;
  environment: TradeEnvironment;
  /** Telegram signal identity used for deduplication */
  chatId?: number;
  messageId?: number;
  signalId?: string;
  /** Original Telegram symbol text (e.g. "XAUUSDm") */
  symbol?: string;
  groupName?: string;
  /** Resolved order kind actually submitted: MARKET | LIMIT | STOP */
  orderType?: string;
  epic: string;
  direction: TradeDirection;
  size: number;
  entryLevel?: number;
  stopLevel?: number;
  takeProfitLevel?: number;
  dealReference?: string;
  dealId?: string;
  status: TradeExecutionStatus;
  error?: string;
  /** Realized P/L reported by Capital.com once closed */
  realizedPnl?: number;
  closedAt?: Date;
  openedAt?: Date;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TradeExecutionSchema: Schema = new Schema(
  {
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
    chatId: { type: Number },
    messageId: { type: Number },
    signalId: { type: String },
    symbol: { type: String, default: null },
    groupName: { type: String, default: null },
    orderType: { type: String, default: null },
    epic: { type: String, required: true },
    direction: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: true,
    },
    size: { type: Number, required: true },
    entryLevel: { type: Number },
    stopLevel: { type: Number },
    takeProfitLevel: { type: Number },
    dealReference: { type: String },
    dealId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'open', 'rejected', 'failed', 'closed', 'cancelled'],
      default: 'pending',
    },
    error: { type: String, default: null },
    realizedPnl: { type: Number, default: null },
    closedAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'TRADE_EXECUTIONS',
  }
);

// One execution per user per Telegram message — prevents duplicate order
// submission while allowing every eligible user to trade the same signal.
TradeExecutionSchema.index(
  { userId: 1, chatId: 1, messageId: 1 },
  {
    unique: true,
    partialFilterExpression: { chatId: { $exists: true }, messageId: { $exists: true } },
    name: 'trade_exec_signal_dedup',
  }
);
TradeExecutionSchema.index({ userId: 1, status: 1 });
TradeExecutionSchema.index({ dealReference: 1 }, { sparse: true });

const TradeExecution: Model<ITradeExecution> =
  mongoose.models.TradeExecution ||
  mongoose.model<ITradeExecution>('TradeExecution', TradeExecutionSchema);

export default TradeExecution;
