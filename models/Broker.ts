import mongoose, { Schema, Document, Model } from 'mongoose';

export type BrokerEnvironment = 'demo' | 'live';
export type BrokerConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'error'
  | 'disconnected';

/**
 * Sanitized account snapshot cached from Capital.com GET /accounts.
 * Never contains credentials or session tokens.
 */
export interface IBrokerAccountInfo {
  accountId?: string;
  accountName?: string;
  currency?: string;
  balance?: number;
  available?: number;
  equity?: number;
  profitLoss?: number;
  accountType?: string;
}

export interface IBroker extends Document {
  userId: mongoose.Types.ObjectId;
  brokerName: string;
  accountEmail: string;
  /** AES-256-GCM encrypted (lib/encryption.ts) — never returned by APIs */
  encryptedApiKey: string;
  /** AES-256-GCM encrypted custom API-key password — never returned by APIs */
  encryptedApiPassword: string;
  environment: BrokerEnvironment;
  connectionStatus: BrokerConnectionStatus;
  /** Operator-controlled activation — 'disabled' blocks all bot execution */
  status: 'active' | 'disabled';
  connectionError?: string;
  accountInfo?: IBrokerAccountInfo;
  /** Encrypted session tokens (CST / X-SECURITY-TOKEN) so sessions survive restarts */
  encryptedSessionCst?: string;
  encryptedSessionXst?: string;
  sessionEnvironment?: BrokerEnvironment;
  lastSessionAt?: Date;
  lastConnectedAt?: Date;
  lastSessionRefreshAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BrokerSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    brokerName: {
      type: String,
      required: true,
      default: 'capital.com',
    },
    accountEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    encryptedApiKey: {
      type: String,
      required: true,
    },
    encryptedApiPassword: {
      type: String,
      required: true,
    },
    environment: {
      type: String,
      enum: ['demo', 'live'],
      default: 'demo',
    },
    connectionStatus: {
      type: String,
      enum: ['not_connected', 'connected', 'error', 'disconnected'],
      default: 'not_connected',
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    connectionError: {
      type: String,
      default: null,
    },
    accountInfo: {
      type: Schema.Types.Mixed,
      default: null,
    },
    encryptedSessionCst: {
      type: String,
      default: null,
    },
    encryptedSessionXst: {
      type: String,
      default: null,
    },
    sessionEnvironment: {
      type: String,
      enum: ['demo', 'live', null],
      default: null,
    },
    lastSessionAt: {
      type: Date,
      default: null,
    },
    lastConnectedAt: {
      type: Date,
      default: null,
    },
    lastSessionRefreshAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'BROKER',
  }
);

// One broker connection per user per broker.
BrokerSchema.index({ userId: 1, brokerName: 1 }, { unique: true });

const Broker: Model<IBroker> =
  mongoose.models.Broker || mongoose.model<IBroker>('Broker', BrokerSchema);

export default Broker;
