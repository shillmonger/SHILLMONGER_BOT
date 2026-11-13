import mongoose, { Schema, Document, Model } from 'mongoose';

export type BotState = 'stopped' | 'running' | 'paused';
export type BotEnvironment = 'demo' | 'live';

/**
 * Per-user bot configuration — one document per authenticated user.
 * These are user PREFERENCES only; they never contain broker credentials
 * and never prove that live trading is authorized.
 */
export interface IBotConfig extends Document {
  userId: mongoose.Types.ObjectId;
  state: BotState;
  environment: BotEnvironment;
  automationEnabled: boolean;
  /** Emergency stop — checked server-side before every order submission */
  emergencyStop: boolean;
  maxOpenPositions: number;
  /** Max risk per trade as a percentage of account equity (e.g. 1 = 1%) */
  riskPercentage: number;
  /** Max realized loss per day in account currency before bot halts */
  maxDailyLoss: number;
  allowedInstruments: string[];
  strategy: string;
  createdAt: Date;
  updatedAt: Date;
}

const BotConfigSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    state: {
      type: String,
      enum: ['stopped', 'running', 'paused'],
      default: 'stopped',
    },
    environment: {
      type: String,
      enum: ['demo', 'live'],
      default: 'demo',
    },
    automationEnabled: {
      type: Boolean,
      default: true,
    },
    emergencyStop: {
      type: Boolean,
      default: false,
    },
    maxOpenPositions: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    /** 0 = defer to admin LotSizeManagement rules */
    riskPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    maxDailyLoss: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowedInstruments: {
      type: [String],
      default: [],
    },
    strategy: {
      type: String,
      default: 'signal-follow',
    },
  },
  {
    timestamps: true,
    collection: 'BOT_CONFIG',
  }
);

const BotConfig: Model<IBotConfig> =
  mongoose.models.BotConfig ||
  mongoose.model<IBotConfig>('BotConfig', BotConfigSchema);

export default BotConfig;
