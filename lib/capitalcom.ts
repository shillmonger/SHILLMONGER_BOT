/**
 * Capital.com Public API service (personal account).
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
 *   - Session tokens live in memory and (encrypted) in the BROKER doc.
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

const sessionCache = new Map<BrokerEnvironment, SessionTokens>();

export function getBaseUrl(env: BrokerEnvironment): string {
  return BASE_URLS[env];
}

/** Load the single personal broker document (null when not configured). */
export async function getBroker(): Promise<IBroker | null> {
  await connectDB();
  return Broker.findOne({ brokerName: 'capital.com' });
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
 * Authenticate against Capital.com and store session tokens.
 * Tokens are kept in memory and persisted ENCRYPTED on the broker doc so
 * sessions survive process restarts without exposing them to the frontend.
 */
export async function authenticate(
  env: BrokerEnvironment,
  broker?: IBroker | null
): Promise<SessionTokens> {
  const doc = broker ?? (await getBroker());
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
  sessionCache.set(env, tokens);

  // Persist encrypted tokens for restart survival. Session env tracks which
  // environment these tokens belong to — demo/live are never mixed.
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
 * Return a valid session for `env`, reusing the in-memory token, then the
 * encrypted persisted token, then performing a fresh authentication.
 */
export async function getSession(env: BrokerEnvironment): Promise<SessionTokens> {
  const cached = sessionCache.get(env);
  if (cached && Date.now() - cached.createdAt < SESSION_MAX_AGE_MS) {
    return cached;
  }

  // Try restoring a persisted session for the same environment.
  const doc = await getBroker();
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
      sessionCache.set(env, tokens);
      return tokens;
    } catch {
      // Corrupt/undecryptable session — fall through to fresh auth.
    }
  }

  return authenticate(env, doc);
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
 * Authenticated request against the Capital.com API.
 *
 * - Attaches CST + X-SECURITY-TOKEN for the requested environment.
 * - On 401/403 performs ONE re-authentication and retries (safe for all
 *   methods except order submission — callers must not use this for
 *   POST /positions retries; use submitPosition + confirmPosition instead).
 * - Never retries on network timeout for non-idempotent requests.
 */
export async function capitalRequest<T = unknown>(
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
  const env = options.env ?? (await getBroker())?.environment ?? 'demo';
  const allowReauth = options.allowReauth !== false;

  const attempt = async (retried: boolean): Promise<CapitalResponse<T>> => {
    let tokens: SessionTokens;
    try {
      tokens = await getSession(env);
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
    } catch (e) {
      const isTimeout =
        e instanceof Error &&
        (e.name === 'TimeoutError' || e.name === 'AbortError');
      return {
        ok: false,
        status: 0,
        data: null,
        // surfaced via thrown CapitalApiError below for clarity
        ...(isTimeout ? {} : {}),
      } as CapitalResponse<T>;
    }

    if ((res.status === 401 || res.status === 403) && allowReauth && !retried) {
      sessionCache.delete(env);
      return attempt(true);
    }

    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }

    let data: T | null = null;
    const text = await res.text();
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

export async function getAccounts(env?: BrokerEnvironment) {
  return capitalRequest<CapitalAccountsResponse>('GET', '/accounts', { env });
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

export async function getPositions(env?: BrokerEnvironment) {
  return capitalRequest<CapitalPositionsResponse>('GET', '/positions', { env });
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
}

export async function getOrders(env?: BrokerEnvironment) {
  return capitalRequest<CapitalOrdersResponse>('GET', '/orders', { env });
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

export async function getMarket(epic: string, env?: BrokerEnvironment) {
  return capitalRequest<{ marketDetails?: CapitalMarket }>(
    'GET',
    `/markets/${encodeURIComponent(epic)}`,
    { env }
  );
}

export async function searchMarkets(searchTerm: string, env?: BrokerEnvironment) {
  return capitalRequest<{ markets?: CapitalMarket[] }>(
    'GET',
    `/markets?searchTerm=${encodeURIComponent(searchTerm)}`,
    { env }
  );
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
 * Submit a market order. Returns the dealReference ONLY — the caller MUST
 * confirm via confirmPosition before treating the trade as executed.
 * This function performs exactly one HTTP attempt: never call it in a
 * retry loop for an uncertain outcome.
 */
export async function createPosition(
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
  return capitalRequest<CreatePositionResponse>('POST', '/positions', {
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
}

export interface ConfirmResponse {
  dealConfirmation?: DealConfirmation;
  [key: string]: unknown;
}

/** GET /confirms/{dealReference} — the ONLY trusted source of order outcome. */
export async function confirmPosition(
  dealReference: string,
  env?: BrokerEnvironment
) {
  return capitalRequest<ConfirmResponse>(
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
  params: { from?: string; to?: string } = {},
  env?: BrokerEnvironment
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return capitalRequest<CapitalHistoryActivityResponse>(
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
  params: { from?: string; to?: string } = {},
  env?: BrokerEnvironment
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return capitalRequest<CapitalTransactionsResponse>(
    'GET',
    `/history/transactions${suffix}`,
    { env, timeoutMs: 20000 }
  );
}

/** DELETE /positions/{dealId} — closes the FULL position for that deal. */
export async function closePosition(dealId: string, env?: BrokerEnvironment) {
  return capitalRequest('DELETE', `/positions/${encodeURIComponent(dealId)}`, {
    env,
    allowReauth: false,
    timeoutMs: 20000,
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolve a signal symbol (e.g. "XAUUSD", "XAU/USD") to a Capital.com epic.
 * Tries the normalized symbol directly, then a market search.
 */
export async function resolveEpic(
  symbol: string,
  env?: BrokerEnvironment
): Promise<string | null> {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return null;

  // Direct epic lookup first (cheap, exact).
  const direct = await getMarket(normalized, env);
  if (direct.ok && direct.data?.marketDetails?.epic) {
    return direct.data.marketDetails.epic;
  }

  const search = await searchMarkets(normalized, env);
  const markets = search.data?.markets ?? [];
  const exact = markets.find(
    (m) => (m.epic ?? '').toUpperCase() === normalized
  );
  if (exact?.epic) return exact.epic;
  // Common FX/metal naming fallbacks
  const fallbacks: Record<string, string[]> = {
    XAUUSD: ['XAUUSD', 'GOLD'],
    XAGUSD: ['XAGUSD', 'SILVER'],
  };
  for (const candidate of fallbacks[normalized] ?? []) {
    const m = await getMarket(candidate, env);
    if (m.ok && m.data?.marketDetails?.epic) return m.data.marketDetails.epic;
  }
  return markets[0]?.epic ?? null;
}
