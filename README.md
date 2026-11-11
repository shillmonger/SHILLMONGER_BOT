# SHILLMONGER / XAU PRIME

Next.js frontend + admin dashboard for the SHILLMONGER Python Telegram
signal-monitoring service (`SHILLMONGER_BOT/`). The Python service owns
Telegram connectivity (Telethon), signal parsing/validation/dedup, and
signal storage in the shared `my-trading-bot` MongoDB database. This app
provides authentication, admin/user dashboards, provider management, and
secure server-side API proxies to the bot.

## Environment variables

See `.env.local`. Bot integration variables (server-side only — never
expose to the browser):

```
BOT_API_URL=http://localhost:8000        # Python FastAPI service URL
BOT_ADMIN_API_KEY=...                    # Bearer key for admin bot endpoints
BOT_FRONTEND_API_KEY=...                 # Bearer key for user-facing bot endpoints
NEXT_PUBLIC_BOT_API_URL=http://localhost:8000  # public URL, health checks only
WORKER_HMAC_SECRET=...                   # MUST equal the Python WORKER_HMAC_SECRET
```

`POST /api/internal/signals/ingest` receives signals from the Python worker,
authenticated by HMAC-SHA256 (`X-Signature`/`X-Timestamp` over
`{timestamp}.{raw_body}`). It is excluded from session middleware and writes
to the shared `signals` collection with the same dedup contract as the
Python ingest endpoint. In production set the Python `BACKEND_URL` to this
app's public URL (e.g. `https://<app>.vercel.app`).

The Python service keeps its own env config in `SHILLMONGER_BOT/.env`
(`API_ID`, `API_HASH`, `PHONE_NUMBER`, `MONGODB_URI`, `BACKEND_URL`,
`WORKER_HMAC_SECRET`, `FRONTEND_API_KEY`, `ADMIN_API_KEY`,
`TELEGRAM_SESSION_STRING`, `SUPPORTED_SYMBOLS`, `DEFAULT_SYMBOL`,
`TELEGRAM_AUTO_START`, `ALLOW_INTERACTIVE_LOGIN`, `SERVER_PORT`).
`BACKEND_URL` there is the worker's signal-forwarding target — point it at
the deployed Next.js app's `/api/internal/signals/ingest` host; it is
unrelated to `BOT_API_URL`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
