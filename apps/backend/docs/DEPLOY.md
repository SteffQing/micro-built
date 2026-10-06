# Deploying the backend (Railway)

Nothing here has been applied yet: these are the settings for the v2 service, to set by hand in the Railway dashboard
at cutover (V2.MD Stage 7 item 5, then Stage 8 for the data).

## Service

| Setting | Value | Why |
| --- | --- | --- |
| Source | `SteffQing/micro-built`, branch `v2` (later `main`) | |
| Root Directory | *(empty: the repo root)* | pnpm must see the workspace (`pnpm-workspace.yaml`, `packages/shared`, one lockfile) |
| Config as code | `apps/backend/railway.json` | build, start and pre-deploy commands live there |
| Watch paths | `apps/backend/**`, `packages/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | a frontend-only change doesn't redeploy the API |
| Region | EU West (Amsterdam), the same for API, Postgres and Redis | closest Railway region to Nigeria; keeps DB/Redis round trips inside one region |
| Node | ≥ 22.12 (the repo's `engines`; `require(esm)` for better-auth) | |
| Custom domain | `api.microbuiltprime.com` | uploads and downloads go direct (cookie on `microbuiltprime.com`) |

`railway.json` runs:
- **build:** `pnpm --filter @microbuilt/backend... build` (the backend plus what it depends on: `packages/shared`).
- **pre-deploy:** `pnpm --filter @microbuilt/backend db:deploy`. This is `prisma migrate deploy`, then
  `prisma/invariants.sql`, then the SYSTEM admin seed. The seed runs here, not at build time, because Railway's private
  network (`*.railway.internal`) isn't reachable during a build.
- **start:** `pnpm --filter @microbuilt/backend start:prod` (`node dist/main`).

## Variables

Copy every key in `apps/backend/.env.example`; the production values:

- `DATABASE_URL`, `REDIS_URL`: Railway references (`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`).
- `BULL_PREFIX=mb2`, distinct from v1's default `bull`. While v1 still runs on the same Redis, neither side takes the
  other's jobs.
- `BETTER_AUTH_SECRET`: new, at least 32 random characters.
- `BETTER_AUTH_URL=https://microbuiltprime.com`, `FRONTEND_URL=https://microbuiltprime.com`.
- `FRONTEND_ORIGINS=https://microbuiltprime.com,https://www.microbuiltprime.com`,
  `API_ORIGIN=https://api.microbuiltprime.com`.
- `AUTH_COOKIE_DOMAIN=microbuiltprime.com`, `PASSKEY_RP_ID=microbuiltprime.com`.
- `EDGE_PROXY_SECRET`: the same value as the frontend's on Vercel.
- `RESEND_API_KEY`, `TERMII_API_KEY` (plus `TERMII_SENDER_ID`), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`, `SENTRY_TRACES_SAMPLE_RATE=0.1`. The release is
  `RAILWAY_GIT_COMMIT_SHA`, which Railway sets.
- `NODE_ENV=production`. Leave `PORT` unset: Railway provides it.

## After the first deploy

1. `GET https://api.microbuiltprime.com/api/auth/ok` answers 200 (better-auth is up).
2. `GET https://api.microbuiltprime.com/docs` serves Swagger.
3. A direct upload works with a session cookie from the frontend, e.g. an avatar (`POST /user/avatar`).
4. `SMOKE_BASE=https://api.microbuiltprime.com pnpm exec tsx scripts/smoke-v2.ts` **only against an empty database.**
   It refuses a database with loans it didn't create. On production, prove the admin release blockers (V2.MD §0.2) by
   hand instead: an admin without 2FA gets 200 on `GET /user` and 403 `TWO_FACTOR_SETUP_REQUIRED` elsewhere, and
   passwordless sign-in is refused.
5. Sentry: one 500 shows up with the release and a user id, and no names, emails, phone numbers or bodies.
