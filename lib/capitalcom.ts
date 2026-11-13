/**
 * Capital.com Public API service (multi-user).
 *
 * Docs: https://open-api.capital.com/
 *
 * Auth flow:
 *   POST /api/v1/session
 *     header: X-CAP-API-KEY: <api key>
 *     body:   { identifier: <account email>, password: <api-key password>,
 *               encryptedPassword: false }
 *   Response HEADERS carry `CST` and `X-SECURITY-TOKEN` (valid ~10 min
 *   after last use). Both must be sent on every subsequent request.
 *
 * Security rules enforced here:
 *   - Credentials are decrypted only inside this module, never returned.
 *   - Session tokens live in memory and (encrypted) on the user's BROKER
 *     doc, keyed per user + environment — sessions are never shared or
 *     mixed between users or between demo/live.
 *   - POST /positions is NEVER retried automatically — an uncertain
 *     order is reconciled via GET /confirms/{dealReference} instead.
 *   - All requests have timeouts.
 */

import connectDB from '@/lib/db';
import Broker, { IBroker, BrokerEnvironment } from '@/models/Broker';
import { encrypt, decrypt } from '@/lib/encryption';

const BASE_URLS: Record<BrokerEnvironment, string> = {
  demo: 'https://demo-api-capital.backend-capital.com',
  live: 'https://api-capital.backend-capital.com',
};

const REQUEST_TIMEOUT_MS = 15000;
/** Re-authenticate proactively when the cached session is older than this */
const SESSION_MAX_AGE_MS = 8 * 60 * 1000;

export class CapitalApiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

interface SessionTokens {
  cst: string;
  xst: string;
  createdAt: number;
}

/** Sessions are isolated per user AND per environment. */
const sessionCache = new Map<string, SessionTokens>();

function sessionKey(userId: string, env: BrokerEnvironment): string {
  return `${userId}:${env}`;
}

export function getBaseUrl(env: BrokerEnvironment): string {
  return BASE_URLS[env];
}

/** Load a user's broker document (null when not configured). */
export async function getBroker(userId: string): Promise<IBroker | null> {
  await connectDB();
  return Broker.findOne({ userId, brokerName: 'capital.com' });
}

function requireCredentials(broker: IBroker): {
  email: string;
  apiKey: string;
  apiPassword: string;
} {
  if (!broker.encryptedApiKey || !broker.encryptedApiPassword) {
    throw new CapitalApiError('Broker credentials are not configured', 400);
  }
  return {
    email: broker.accountEmail,
    apiKey: decrypt(broker.encryptedApiKey),
    apiPassword: decrypt(broker.encryptedApiPassword),
  };
}

/**
 * Authenticate a user's Capital.com account and store session tokens.
 * Tokens are kept in memory and persisted ENCRYPTED on that user's broker
 * doc so sessions survive restarts without exposure.
 */
export async function authenticate(
  userId: string,
  env: BrokerEnvironment,
  broker?: IBroker | null
): Promise<SessionTokens> {
  const doc = broker ?? (await getBroker(userId));
  if (!doc) throw new CapitalApiError('Broker account not connected', 400);

  const { email, apiKey, apiPassword } = requireCredentials(doc);
  const base = getBaseUrl(env);

  const res = await fetch(`${base}/api/v1/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CAP-API-KEY': apiKey,
    },
    body: JSON.stringify({
      identifier: email,
      password: apiPassword,
      encryptedPassword: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await safeText(res);
    // Never include credentials or tokens in the error.
    throw new CapitalApiError(
      `Capital.com authentication failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`,
      res.status === 401 || res.status === 403 ? 401 : 502
    );
  }

  const cst = res.headers.get('cst');
  const xst = res.headers.get('x-security-token');
  if (!cst || !xst) {
    throw new CapitalApiError('Capital.com session response missing tokens', 502);
  }

  const tokens: SessionTokens = { cst, xst, createdAt: Date.now() };
  sessionCache.set(sessionKey(userId, env), tokens);

  // Persist encrypted tokens for restart survival. sessionEnvironment tracks
  // which environment these tokens belong to — never mixed.
  await connectDB();
  await Broker.updateOne(
    { _id: doc._id },
    {
      $set: {
        encryptedSessionCst: encrypt(cst),
        encryptedSessionXst: encrypt(xst),
        sessionEnvironment: env,
        lastSessionAt: new Date(),
        lastSessionRefreshAt: new Date(),
      },
    }
  );

  return tokens;
}

/**
 * Return a valid session for (userId, env): in-memory token first, then the
 * encrypted persisted token, then fresh authentication.
 */
export async function getSession(
  userId: string,
  env: BrokerEnvironment
): Promise<SessionTokens> {
  const key = sessionKey(userId, env);
  const cached = sessionCache.get(key);
  if (cached && Date.now() - cached.createdAt < SESSION_MAX_AGE_MS) {
    return cached;
  }

  const doc = await getBroker(userId);
  if (
    doc &&
    doc.sessionEnvironment === env &&
    doc.encryptedSessionCst &&
    doc.encryptedSessionXst &&
    doc.lastSessionAt &&
    Date.now() - new Date(doc.lastSessionAt).getTime() < SESSION_MAX_AGE_MS
  ) {
    try {
      const tokens: SessionTokens = {
        cst: decrypt(doc.encryptedSessionCst),
        xst: decrypt(doc.encryptedSessionXst),
        createdAt: new Date(doc.lastSessionAt).getTime(),
      };
      sessionCache.set(key, tokens);
      return tokens;
    } catch {
      // Corrupt/undecryptable session — fall through to fresh auth.
    }
  }

  return authenticate(userId, env, doc);
}

async function safeText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 300);
  } catch {
    return '';
  }
}

export interface CapitalResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
}

/**
 * Authenticated request against the Capital.com API for a specific user.
 *
 * - Attaches that user's CST + X-SECURITY-TOKEN for the requested env.
 * - On 401/403 performs ONE re-authentication and retries (callers must
 *   not rely on this for order submission — createPosition uses
 *   allowReauth:false).
 * - Never retries on network timeout.
 */
export async function capitalRequest<T = unknown>(
  userId: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: {
    env?: BrokerEnvironment;
    body?: unknown;
    /** When true, a 401 triggers re-auth + single retry */
    allowReauth?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<CapitalResponse<T>> {
  const env =
    options.env ??
    ((await getBroker(userId))?.environment as BrokerEnvironment | undefined) ??
    'demo';
  const allowReauth = options.allowReauth !== false;

  const attempt = async (retried: boolean): Promise<CapitalResponse<T>> => {
    let tokens: SessionTokens;
    try {
      tokens = await getSession(userId, env);
    } catch (e) {
      if (e instanceof CapitalApiError) {
        return { ok: false, status: e.status, data: null };
      }
      throw e;
    }

    const base = getBaseUrl(env);
    let res: Response;
    try {
      res = await fetch(`${base}/api/v1${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          CST: tokens.cst,
          'X-SECURITY-TOKEN': tokens.xst,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch {
      return { ok: false, status: 0, data: null };
    }

    if ((res.status === 401 || res.status === 403) && allowReauth && !retried) {
      sessionCache.delete(sessionKey(userId, env));
      return attempt(true);
    }

    const text = await res.text();
    if (!res.ok) {
      // Surface the broker's error body so callers can record WHY a
      // request was rejected (e.g. invalid goodTillDate format).
      let errData: unknown = null;
      try {
        errData = text ? JSON.parse(text) : null;
      } catch {
        errData = text ? { error: text.slice(0, 300) } : null;
      }
      return { ok: false, status: res.status, data: errData as T | null };
    }

    let data: T | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = null;
      }
    }
    return { ok: true, status: res.status, data };
  };

  const result = await attempt(false);
  if (!result.ok && result.status === 0) {
    throw new CapitalApiError('Capital.com request timed out or network error', 504);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Typed endpoint wrappers                                             */
/* ------------------------------------------------------------------ */

export interface CapitalAccount {
  accountId?: string;
  accountName?: string;
  preferred?: boolean;
  balance?: {
    balance?: number;
    deposit?: number;
    profitLoss?: number;
    available?: number;
  };
}

export interface CapitalAccountsResponse {
  accounts?: CapitalAccount[];
  accountType?: string;
  currencyIsoCode?: string;
}

export async function getAccounts(userId: string, env?: BrokerEnvironment) {
  return capitalRequest<CapitalAccountsResponse>(userId, 'GET', '/accounts', { env });
}

export interface CapitalPositionMarket {
  epic?: string;
  instrumentName?: string;
  instrumentType?: string;
  marketStatus?: string;
  bid?: number;
  offer?: number;
  high?: number;
  low?: number;
  percentageChange?: number;
  updateTimeUTC?: string;
}

export interface CapitalPosition {
  dealId?: string;
  dealReference?: string;
  direction?: 'BUY' | 'SELL' | string;
  size?: number;
  level?: number;
  stopLevel?: number;
  profit?: number;
  profitLoss?: number;
  upl?: number;
  currency?: string;
  createdDate?: string;
  workingOrderId?: string;
  guaranteedStop?: boolean;
}

export interface CapitalPositionEntry {
  position?: CapitalPosition;
  market?: CapitalPositionMarket;
}

export interface CapitalPositionsResponse {
  positions?: CapitalPositionEntry[];
}

export async function getPositions(userId: string, env?: BrokerEnvironment) {
  return capitalRequest<CapitalPositionsResponse>(userId, 'GET', '/positions', { env });
}

export interface CapitalWorkingOrder {
  workingOrderId?: string;
  epic?: string;
  direction?: string;
  size?: number;
  level?: number;
  type?: string;
  stopLevel?: number;
  profitLevel?: number;
  createdDate?: string;
}

export interface CapitalOrdersResponse {
  orders?: Array<{ workingOrderData?: CapitalWorkingOrder } & CapitalWorkingOrder>;
  /** Actual field name returned by GET /api/v1/workingorders */
  workingOrders?: Array<{ workingOrderData?: CapitalWorkingOrder } & CapitalWorkingOrder>;
}

export async function getOrders(userId: string, env?: BrokerEnvironment) {
  // NOTE: Capital.com spells this endpoint all-lowercase — /workingorders.
  // /orders returns 404.
  return capitalRequest<CapitalOrdersResponse>(userId, 'GET', '/workingorders', { env });
}

export interface CapitalMarket {
  epic?: string;
  name?: string;
  instrumentType?: string;
  marketStatus?: string;
  snapshot?: {
    bid?: number;
    offer?: number;
    marketStatus?: string;
  };
  minDealSize?: number;
  maxDealSize?: number;
  dealSizeIncrement?: number;
  contractSize?: number;
}

export async function getMarket(userId: string, epic: string, env?: BrokerEnvironment) {
  return capitalRequest<{ marketDetails?: CapitalMarket }>(
    userId,
    'GET',
    `/markets/${encodeURIComponent(epic)}`,
    { env }
  );
}

export async function searchMarkets(userId: string, searchTerm: string, env?: BrokerEnvironment) {
  return capitalRequest<{ markets?: CapitalMarket[] }>(
    userId,
    'GET',
    `/markets?searchTerm=${encodeURIComponent(searchTerm)}`,
    { env }
  );
}

export interface CapitalPriceSnapshot {
  bid?: number;
  offer?: number;
  marketStatus?: string;
  updateTimeUTC?: string;
}

/**
 * GET /api/v1/prices/{epic} — live quote. marketDetails from /markets does
 * NOT reliably include snapshot bid/offer; this endpoint does.
 */
export async function getPrice(
  userId: string,
  epic: string,
  env?: BrokerEnvironment
) {
  return capitalRequest<{
    prices?: { snapshot?: CapitalPriceSnapshot };
    snapshot?: CapitalPriceSnapshot;
  }>(userId, 'GET', `/prices/${encodeURIComponent(epic)}`, { env });
}

export interface CreatePositionParams {
  epic: string;
  direction: 'BUY' | 'SELL';
  size: number;
  stopLevel?: number;
  profitLevel?: number;
  guaranteedStop?: boolean;
}

export interface CreatePositionResponse {
  dealReference?: string;
}

/**
 * Submit a market order for a user. Returns the dealReference ONLY — the
 * caller MUST confirm via confirmPosition before treating the trade as
 * executed. Exactly one HTTP attempt: never call in a retry loop.
 */
export async function createPosition(
  userId: string,
  params: CreatePositionParams,
  env?: BrokerEnvironment
): Promise<CapitalResponse<CreatePositionResponse>> {
  const body: Record<string, unknown> = {
    epic: params.epic,
    direction: params.direction,
    size: params.size,
    guaranteedStop: params.guaranteedStop ?? false,
  };
  if (params.stopLevel !== undefined) body.stopLevel = params.stopLevel;
  if (params.profitLevel !== undefined) body.profitLevel = params.profitLevel;

  // allowReauth=false is intentional for order submission: if the session
  // expired mid-flight we must NOT silently retry a possibly-accepted order.
  return capitalRequest<CreatePositionResponse>(userId, 'POST', '/positions', {
    env,
    body,
    allowReauth: false,
    timeoutMs: 20000,
  });
}

export interface WorkingOrderParams {
  epic: string;
  direction: 'BUY' | 'SELL';
  /** Capital.com working-order type */
  type: 'LIMIT' | 'STOP';
  size: number;
  /** Trigger/limit price — required for working orders */
  level: number;
  stopLevel?: number;
  profitLevel?: number;
  guaranteedStop?: boolean;
  /** ISO-8601 expiry — Capital.com requires this for working orders */
  goodTillDate: string;
}

export interface WorkingOrderResponse {
  dealReference?: string;
  workingOrder?: {
    workingOrderId?: string;
    dealReference?: string;
    epic?: string;
    direction?: string;
    type?: string;
    level?: number;
    size?: number;
    status?: string;
  };
}

/**
 * Submit a pending (working) order — LIMIT or STOP — for a user.
 * Returns the dealReference ONLY; the caller MUST confirm via
 * confirmPosition before treating the order as resting. Exactly one
 * HTTP attempt: never call in a retry loop.
 */
export async function createWorkingOrder(
  userId: string,
  params: WorkingOrderParams,
  env?: BrokerEnvironment
): Promise<CapitalResponse<WorkingOrderResponse>> {
  const body: Record<string, unknown> = {
    epic: params.epic,
    direction: params.direction,
    type: params.type,
    size: params.size,
    level: params.level,
    goodTillDate: params.goodTillDate,
    guaranteedStop: params.guaranteedStop ?? false,
  };
  if (params.stopLevel !== undefined) body.stopLevel = params.stopLevel;
  if (params.profitLevel !== undefined) body.profitLevel = params.profitLevel;

  // allowReauth=false — same rule as createPosition: never silently
  // retry an order submission that may have been accepted.
  return capitalRequest<WorkingOrderResponse>(userId, 'POST', '/workingorders', {
    env,
    body,
    allowReauth: false,
    timeoutMs: 20000,
  });
}

export interface DealConfirmation {
  dealStatus?: string;
  affectedDeals?: Array<{
    dealId?: string;
    epic?: string;
    direction?: string;
    size?: number;
    level?: number;
    status?: string;
  }>;
  /** Present when confirming a working order instead of a position */
  workingOrder?: {
    workingOrderId?: string;
    dealId?: string;
    status?: string;
  };
}

export interface ConfirmResponse {
  dealConfirmation?: DealConfirmation;
  /** Alternate confirmation envelope returned for working orders */
  workingOrderConfirmation?: DealConfirmation;
  [key: string]: unknown;
}

/** GET /confirms/{dealReference} — the ONLY trusted source of order outcome. */
export async function confirmPosition(
  userId: string,
  dealReference: string,
  env?: BrokerEnvironment
) {
  return capitalRequest<ConfirmResponse>(
    userId,
    'GET',
    `/confirms/${encodeURIComponent(dealReference)}`,
    { env }
  );
}

export interface CapitalActivity {
  /** Activity payload shape varies; keep tolerant */
  [key: string]: unknown;
  epic?: string;
  dealId?: string;
  direction?: string;
  size?: number;
  level?: number;
  profit?: number;
  profitLoss?: number;
  type?: string;
  status?: string;
  createdDate?: string;
  createdDateUTC?: string;
}

export interface CapitalHistoryActivityResponse {
  activities?: Array<{ activity?: CapitalActivity } & CapitalActivity>;
}

export async function getHistoryActivity(
  userId: string,
  params: { from?: string; to?: string } = {},
  env?: BrokerEnvironment
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return capitalRequest<CapitalHistoryActivityResponse>(
    userId,
    'GET',
    `/history/activity${suffix}`,
    { env, timeoutMs: 20000 }
  );
}

export interface CapitalTransaction {
  [key: string]: unknown;
  transactionId?: string;
  type?: string;
  amount?: number;
  currency?: string;
  createdDate?: string;
}

export interface CapitalTransactionsResponse {
  transactions?: CapitalTransaction[];
}

export async function getTransactions(
  userId: string,
  params: { from?: string; to?: string } = {},
  env?: BrokerEnvironment
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return capitalRequest<CapitalTransactionsResponse>(
    userId,
    'GET',
    `/history/transactions${suffix}`,
    { env, timeoutMs: 20000 }
  );
}

/** DELETE /positions/{dealId} — closes the FULL position for that deal. */
export async function closePosition(userId: string, dealId: string, env?: BrokerEnvironment) {
  return capitalRequest(userId, 'DELETE', `/positions/${encodeURIComponent(dealId)}`, {
    env,
    allowReauth: false,
    timeoutMs: 20000,
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolve a signal symbol (e.g. "XAUUSD", "XAU/USD") to a Capital.com epic
 * using a specific user's session.
 */
export async function resolveEpic(
  userId: string,
  symbol: string,
  env?: BrokerEnvironment
): Promise<string | null> {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return null;

  const direct = await getMarket(userId, normalized, env);
  if (direct.ok && direct.data?.marketDetails?.epic) {
    return direct.data.marketDetails.epic;
  }

  const search = await searchMarkets(userId, normalized, env);
  const markets = search.data?.markets ?? [];
  const exact = markets.find(
    (m) => (m.epic ?? '').toUpperCase() === normalized
  );
  if (exact?.epic) return exact.epic;
  const fallbacks: Record<string, string[]> = {
    XAUUSD: ['XAUUSD', 'GOLD'],
    XAGUSD: ['XAGUSD', 'SILVER'],
  };
  for (const candidate of fallbacks[normalized] ?? []) {
    const m = await getMarket(userId, candidate, env);
    if (m.ok && m.data?.marketDetails?.epic) return m.data.marketDetails.epic;
  }
  return markets[0]?.epic ?? null;
}
