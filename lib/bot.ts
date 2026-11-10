/**
 * Server-side client for the SHILLMONGER Python FastAPI service.
 *
 * All calls happen on the Next.js server — the bot API keys are never
 * exposed to the browser. The Python service remains the source of truth
 * for Telegram connectivity, signal parsing/validation, and signal storage.
 */

export type BotKey = "admin" | "frontend";

interface BotConfig {
  url: string;
  adminKey?: string;
  frontendKey?: string;
}

function getBotConfig(): BotConfig {
  return {
    url: (process.env.BOT_API_URL || "").replace(/\/+$/, ""),
    adminKey: process.env.BOT_ADMIN_API_KEY,
    frontendKey: process.env.BOT_FRONTEND_API_KEY,
  };
}

/**
 * Returns "host[:port]" for diagnostics, or null when the URL is invalid.
 * Never includes credentials, query strings, or keys.
 */
function safeHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return null;
  }
}

export function isBotConfigured(): boolean {
  const { url } = getBotConfig();
  return Boolean(url);
}

export interface BotResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

/**
 * Call the Python bot API.
 *
 * - `key: "admin"`    -> Authorization: Bearer BOT_ADMIN_API_KEY
 * - `key: "frontend"` -> Authorization: Bearer BOT_FRONTEND_API_KEY
 * - `key: "none"`     -> no auth header (e.g. /api/health)
 *
 * Never throws for HTTP errors or network failures — always resolves to a
 * BotResponse so route handlers can return consistent JSON.
 */
export async function botFetch(
  path: string,
  options: {
    method?: string;
    key?: BotKey | "none";
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    timeoutMs?: number;
  } = {}
): Promise<BotResponse> {
  const { url, adminKey, frontendKey } = getBotConfig();
  const host = safeHost(url);
  const hasAdminKey = Boolean(adminKey);
  const hasFrontendKey = Boolean(frontendKey);
  const { method = "GET", key = "none", body, query, timeoutMs = 10000 } = options;

  console.log(
    `[bot] request ${method} ${path} -> configured=${Boolean(url)} host=${host ?? "invalid"} authKey=${key === "admin" ? `admin(present=${hasAdminKey})` : key === "frontend" ? `frontend(present=${hasFrontendKey})` : "none"}`
  );

  if (!url) {
    return {
      ok: false,
      status: 503,
      data: { error: "Bot service is not configured (BOT_API_URL missing)" },
    };
  }

  let target = `${url}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) target += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key === "admin" && adminKey) headers["Authorization"] = `Bearer ${adminKey}`;
  if (key === "frontend" && frontendKey)
    headers["Authorization"] = `Bearer ${frontendKey}`;

  try {
    console.log(`[bot] fetch start ${method} ${host}${path}`);
    const response = await fetch(target, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    console.log(`[bot] fetch completed ${method} ${host}${path} -> HTTP ${response.status}`);

    let data: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: "Invalid response from bot service" };
      }
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    // Log only safe diagnostic fields — never headers or keys.
    const errName = error instanceof Error ? error.name : typeof error;
    const errMessage = error instanceof Error ? error.message : String(error);
    const errCause =
      error instanceof Error && error.cause instanceof Error
        ? `${error.cause.name}:${(error.cause as NodeJS.ErrnoException).code ?? error.cause.message}`
        : error instanceof Error && error.cause
          ? String(error.cause)
          : "none";
    console.error(
      `[bot] fetch failed ${method} ${host}${path} -> name=${errName} message=${errMessage} cause=${errCause}`
    );
    return {
      ok: false,
      status: 502,
      data: {
        error: isTimeout
          ? "Bot service timed out"
          : "Bot service is unreachable",
      },
    };
  }
}
