# CLAUDE.md — backend

NestJS 11 API + Prisma 6 (Postgres) for **MicroBuilt**, payroll-deduction loans for Nigerian public servants. Part of
the pnpm monorepo (see the root `CLAUDE.md`); the v2 design and its decisions live in `docs/V2.MD`, the API changes the
frontend codes against in `docs/V2_API_CHANGES.md` (deploying: `docs/DEPLOY.md`).

## Commands (from `apps/backend`, or `pnpm --filter @microbuilt/backend <script>` from the root)

```bash
pnpm start:dev                 # watch mode; Swagger at http://localhost:3003/docs
pnpm build                     # nest build → dist/main.js (fonts copied as assets)
pnpm start:prod                # node dist/main
pnpm test                      # unit tests (Jest)
LEDGER_IT=1 pnpm exec jest src/ledger/ledger.integration.spec.ts   # whole payroll cycles against the dev DB, in 2099
pnpm exec tsx scripts/smoke-v2.ts     # end-to-end over HTTP against a running API (refuses a DB with other loans)
pnpm exec tsx scripts/auth-smoke.ts   # better-auth flows against the dev DB / Redis
pnpm typecheck
pnpm exec eslint "src/**/*.ts"       # `pnpm lint` adds --fix
pnpm db:deploy                 # prisma migrate deploy + prisma/invariants.sql + the SYSTEM admin seed (db:seed)
pnpm exec prisma generate      # after a schema change (also runs on install)
```

Never `prisma migrate reset` (it drops the database). New migrations: `pnpm exec prisma migrate dev --create-only`,
review the SQL, then `pnpm db:deploy`. Anything Prisma can't express (partial unique indexes, CHECKs) goes in
`prisma/invariants.sql`, which is idempotent.

## Layout

| Path | What |
| --- | --- |
| `src/auth` | better-auth (`auth.config.ts`, `auth.runtime.ts`), the global `AccessGuard`, decorators, `AuthAccountsService`, the typed client exported as `@microbuilt/backend/auth-client` |
| `src/ledger` | **The money engine.** Disbursements, top-ups, penalties, payments (ratio method), liquidations, tenure changes, deductions, months, per-organization variations, locking them (vouchers, no payroll: settlement, reverts, rematch), statements, balances. Emits `ledger.events.ts` events after commit |
| `src/user` | Customer API: profile, PPI, notifications, loan requests, repayments |
| `src/admin` | Admin API: loans + top-ups, customers + onboarding, customer page, repayments + vouchers, variations, tenure changes, dashboard, exports, admins |
| `src/organizations` | Organizations (the employers whose payroll deducts): list, merge, org-switch change requests |
| `src/liquidations` | Liquidation requests with proof (shared by `/user` and `/admin/customer/:id`) |
| `src/statements` | Statement JSON and statement/report file requests |
| `src/documents` | Generated files: `DocumentsService.deliver` (private bucket → in-app link + email), `CustomerReportService`, PDF/XLSX rendering, the `reports` queue consumer |
| `src/queue/bull` | Bull queues `repayments`, `reports`, `services`, `maintenance` (producers; consumers live with their domain module) |
| `src/queue/events` | `ledger.listeners.ts`: ledger events → customer and admin notifications |
| `src/notifications` | Mail (Resend + React Email), SMS (Termii), in-app, `AdminNotifierService`, `NotificationStreamService` (SSE signal over Redis pub/sub; write notification rows only through `InappService` so streams hear of them) |
| `src/settings`, `src/commodities` | Rates/maintenance singleton; the commodity catalogue (`/config` reads both) |
| `src/database` | `PrismaService`, `RedisService`, `SupabaseService` (private buckets + signed URLs; public avatars) |
| `src/common` | DTO helpers (`IsMoney`, periods, loan figures), decorators, Sentry (`observability.ts`), utils |

## Rules that keep the money right (V2.MD §0.5)

- **Money only moves through `src/ledger`.** Never write `Loan.owed/repaid`, `MicroLoan`, `Repayment`, `Deduction` or
  `TenureChange` rows from a feature module. Several ledger calls that form one unit run inside
  `LedgerTx.transaction(async (tx) => …)` and pass `tx` on.
- Amounts are `Prisma.Decimal` (`money()`); responses convert with `toNumber`. Periods are `{ year, month }` in Lagos
  time (UTC+1): `YYYY-MM` in queries, labels like `"JUNE 2026"` in responses.
- Decisions use compare-and-swap (`updateMany` on the status) → 409 "Already decided by another admin".
- Rates are snapshotted onto a loan at approval; `SettingsService.requireRates()` → 409 until a super admin sets them.

## Auth (better-auth, cookies)

- Sessions are cookies (`better-auth.session_token`); a `set-auth-token` header gives tools a bearer token.
  Auth routes live under `/api/auth/*` (reference at `/api/auth/reference`).
- **Every route is private by default** (global `AccessGuard`). Use `@Access(...roles)`, `@AllowAnonymous()`,
  `@CurrentUser()`. Super admins without 2FA or a passkey get 403 `TWO_FACTOR_SETUP_REQUIRED` everywhere except
  `GET /user` (`@AllowWithoutTwoFactor()`); admins and marketers aren't made to set either up. Super admins sign in with a
  passkey or password + 2FA, never a magic link or emailed/SMS code (everyone else may). Prove these with `scripts/smoke-v2.ts` before a release.
- **Core actions need a fresh confirmation:** `@Confirm('action')` (money and ledger: one code or passkey per call) or
  `@Confirm('window')` (disbursing, settings, admin management, adding customers: one in the last ten minutes), enforced by
  `ConfirmationGuard`. A new gated endpoint gets one of the two.
- Accounts the platform creates (invites, onboarding, bulk import) go through `AuthAccountsService`.
- Specs never load better-auth (ESM): `jest.mock('src/auth/auth-accounts.service', …)` in anything that imports it.

## Routing

JSON goes through the frontend origin (`https://microbuiltprime.com/api/<path>`, a Vercel rewrite). Uploads (payroll
sheets, liquidation proofs, avatars) go **direct** to `https://api.microbuiltprime.com/<path>`. Files we hand out
(exports, statements, reports, variation files, proofs) are signed links to private Supabase buckets.

## Environment

Every variable is documented in `.env.example`. The essentials: `DATABASE_URL`, `REDIS_URL`, `BULL_PREFIX` (Redis key
prefix for the queues; give each environment sharing a Redis its own), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`FRONTEND_URL`, `FRONTEND_ORIGINS`, `PASSKEY_RP_ID`, `EDGE_PROXY_SECRET`, `RESEND_API_KEY`, `TERMII_*`,
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SENTRY_*`. Node ≥ 22.12 (`require(esm)`).

## Conventions

- Swagger decorators on every endpoint (`ApiOkBaseResponse`, `ApiOkPaginatedResponse`, `ApiGenericErrorResponse`, …
  in `src/common/decorators`). Responses are `{ data, message }` (+ `meta` on lists).
- Errors people read are plain sentences; 4xx are never reported to Sentry, everything else is.
- Log every API change for the frontend in `docs/V2_API_CHANGES.md`.

DO NOT USE SUPERPOWER PLUGIN UNLESS CALLED MANUALLY
