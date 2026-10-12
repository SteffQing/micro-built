# MicroBuilt Prime — Handover

Everything MicroBuilt Prime runs on, who it talks to, and how to operate it. Secrets are never written here: every
value lives in the service it belongs to (Railway variables, provider dashboards). Variable names are listed so you know
what to look for. Last updated 2026-10-12, after the v2 cutover.

## 1. At a glance

| Piece | Where | Address |
| --- | --- | --- |
| Frontend (Next.js 16) | Railway service `frontend` | https://microbuiltprime.com (+ `www`) |
| Backend API (NestJS 11 + Prisma 6) | Railway service `ravishing-light` | https://api.microbuiltprime.com |
| PostgreSQL | Railway service `Postgres` | private network only |
| Redis (queues, rate limits, live updates) | Railway service `Redis` | private network only |
| DNS, CDN, Turnstile, Workers AI | Cloudflare | zone `microbuiltprime.com` |
| Domain registration | Namecheap | nameservers point to Cloudflare |
| File storage | Supabase Storage | project `hlvusfvooxvhazayudnt` |
| Email sending | Resend (on Amazon SES, EU West 1) | from `*@updates.microbuiltprime.com` |
| SMS | Termii | sender ID `MicroBuilt` |
| AI chat support (Prime) | Google AI Studio, Groq, Cerebras, Cloudflare Workers AI | — |
| Error monitoring | Sentry, org `steffqing` (EU) | projects `microbuilt-be`, `microbuilt-fe` |
| Source code and CI | GitHub `SteffQing/micro-built`, CI on Namespace runners | branch `v2` is production |

Old v1: Railway service `micro-built` still exists but has no domain. It's waiting to be retired (see §12).

## 2. Source code, branches and CI

- **Repo:** `SteffQing/micro-built` (GitHub). It's a pnpm monorepo: `apps/backend`, `apps/frontend`, `packages/shared`.
  Read `CLAUDE.md` at the root and in each app before changing anything.
- **Production branch:** `v2`. Every push to `v2` deploys (see §3). `main` is the repo's default branch but is not deployed.
- **CI:** `.github/workflows/ci.yml` runs install, typecheck, lint, tests and build on **Namespace** runners
  (`runs-on: namespace-profile-default`). The Namespace account is linked to the GitHub org; if CI stops picking up jobs,
  check the Namespace profile first.
- **Lockfile:** one `pnpm-lock.yaml` for the whole repo. A lockfile out of step with a `package.json` breaks Railway and CI
  builds, so run `pnpm install` and commit the lockfile with any dependency change.
- **Design docs:** `apps/backend/docs/V2.MD`, `apps/frontend/docs/V2.MD`, `apps/backend/docs/CHAT_SUPPORT.md`,
  `apps/frontend/docs/CHAT_SUPPORT.md`; API changes for the frontend in `apps/backend/docs/V2_API_CHANGES.md`.

## 3. Railway (hosting)

Project **MicroBuilt Prime**, environment `production`, region `europe-west4`. Both apps build from GitHub `v2`.

| Service | Build | Start | Redeploys when these change |
| --- | --- | --- | --- |
| `ravishing-light` (API) | `pnpm --filter @microbuilt/backend... build` | `node apps/backend/dist/main.js` | `/apps/backend/**`, `/packages/**`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml` |
| `frontend` | `pnpm --filter @microbuilt/shared build && pnpm --filter @microbuilt/frontend build` | `node apps/frontend/node_modules/next/dist/bin/next start apps/frontend` | `/apps/frontend/**`, `/packages/**`, `/apps/backend/src/auth/**`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml` |
| `Postgres` | Railway template | — | — |
| `Redis` | Railway template (volume, password auth) | — | — |

- **The dashboard is the source of truth** for build, start and watch settings. `apps/backend/railway.json` mirrors the API's
  settings but Railway doesn't read it (no config-file path is set), so change the dashboard and keep the file in step.
- **Migrations run on deploy:** the API's pre-deploy command is `pnpm --filter @microbuilt/backend db:deploy` (Prisma
  migrate deploy, then `prisma/invariants.sql`, then the SYSTEM admin seed). A failed migration stops the deploy; the old
  version keeps serving. Never run `prisma migrate reset`: it wipes the database.
- **Node is started directly**, not through pnpm, which saves about 60 MB of memory per service.
- **Rollback:** open the service's Deployments tab in Railway and redeploy an earlier successful one. Database migrations do
  not roll back on their own.
- **Memory:** the API idles around 290 MB, which is the cost of loading its libraries, not a leak. Spikes come from deploys,
  when the old and new versions run side by side.
- **Admin tools on the API:** Swagger at `https://api.microbuiltprime.com/docs`, better-auth reference at
  `/api/auth/reference`, and Bull Board (queues) at `/queues`. Bull Board is for super admins with 2FA or a passkey
  only; sign in on the dashboard first.

### API variables (`ravishing-light`)

| Group | Variables |
| --- | --- |
| Database / cache | `DATABASE_URL`, `REDIS_URL`, `BULL_PREFIX` (queue key prefix, keep it unique per environment) |
| Auth (better-auth) | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (= `https://microbuiltprime.com`), `FRONTEND_URL`, `FRONTEND_ORIGINS` (= apex + `www`), `API_ORIGIN` (= `https://api.microbuiltprime.com`), `AUTH_COOKIE_DOMAIN` (= `microbuiltprime.com`), `PASSKEY_RP_ID` (= `microbuiltprime.com`), `EDGE_PROXY_SECRET` |
| Email / SMS | `RESEND_API_KEY`, `TERMII_API_KEY` (`TERMII_SENDER_ID`, `TERMII_BASE_URL` default to `MicroBuilt` / `api.ng.termii.com`) |
| Storage | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| Monitoring | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |
| Chat support | `SUPPORT_ENABLED`, `SUPPORT_CHAIN`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN`, `TURNSTILE_SECRET_KEY` (`SUPPORT_EMAIL` defaults to `support@microbuiltprime.com`) |
| Runtime | `NODE_ENV`; `PORT` is set by Railway |
| First super admin | `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_NAME`, `SEED_SUPERADMIN_PASSWORD`; used only when that user doesn't exist. **Remove the password variable** now that the admin exists |

Every variable is explained in `apps/backend/.env.example`.

### Frontend variables (`frontend`)

`API_ORIGIN` and `NEXT_PUBLIC_API_URL` (both `https://api.microbuiltprime.com`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and
`EDGE_PROXY_SECRET`, which is a Railway reference to the API's own value, so the two always match. `NEXT_PUBLIC_*` values are
baked in at build time: changing one needs a redeploy. Not set yet: `NEXT_PUBLIC_SENTRY_DSN` (frontend errors aren't
reported), `NEXT_PUBLIC_PHONE_AUTH` (phone sign-in stays off), `NEXT_PUBLIC_SUPPORT_EMAIL` (defaults to the support
address). See `apps/frontend/.env.example`.

## 4. Frontend

- Next.js 16 app. Pages, the customer and admin dashboards, the `/support` page and the Help & support modal.
- **How it reaches the API:**
  - JSON goes to `https://microbuiltprime.com/api/<path>`, which Next.js rewrites to the API, so cookies stay first-party
    and there is no CORS.
  - `/api/auth/*` goes through `src/proxy.ts`. It adds `x-mb-edge` (the shared `EDGE_PROXY_SECRET`) and the visitor's real
    IP, so the API's rate limits count real visitors.
  - Uploads and downloads go **directly** to `https://api.microbuiltprime.com` with the session cookie, which is shared on
    `microbuiltprime.com`.
  - Live notifications (SSE) also connect directly to the API.
- Images: `next/image` serves Supabase public avatars (allowed in `next.config.ts`).

## 5. Backend

- NestJS 11 API with Prisma 6. **All money moves through `src/ledger`.** Read the rules in `apps/backend/CLAUDE.md`
  before changing anything that touches loans, repayments or balances.
- **Auth:** better-auth with cookie sessions, 2FA (TOTP or code), passkeys, magic links and email codes.
  - Super admins must use a passkey, or a password plus 2FA.
  - Core actions need a fresh confirmation (`@Confirm`).
- **Queues (Bull v3 on Redis):** `repayments`, `reports`, `services`, `maintenance`. Repeating jobs:

  | Job | Schedule | Purpose |
  | --- | --- | --- |
  | `supabase-keep-alive` | every 3rd day, 00:00 | keeps the Supabase project from pausing when idle |
  | `callout-sweep` | hourly at :17 | expires callouts whose own expiry job was lost |
  | `support-sweep` | 03:00 Lagos daily | closes or deletes support conversations a lost job missed |
  | `variation-reminder` | 09:00 Lagos on the 1st | reminds admins the month's variation can be submitted |

  Support conversations auto-close 24 h after the last message and are deleted 7 days after closing, each through its
  own delayed job.
- **Generated files** (statements, reports, exports, variation files) are rendered as PDF or XLSX in the `reports`
  queue, stored in private Supabase buckets, and handed out as signed links (in-app and by email).

## 6. PostgreSQL

- Railway service `Postgres`; the API reaches it through `DATABASE_URL`.
- The schema is in `apps/backend/prisma/schema.prisma`, with migrations in `prisma/migrations`. Rules Prisma can't express
  (partial unique indexes, CHECKs) live in `prisma/invariants.sql`, which is idempotent.
- **New migration:** `pnpm exec prisma migrate dev --create-only`, review the SQL, commit, and push. The deploy applies it.
- **Backups:** check that Railway's backups are turned on for the Postgres service (see §12). This holds the loan ledger.

## 7. Redis

- Railway service `Redis` (`REDIS_URL`). It holds:
  - the Bull queues, under the prefix `BULL_PREFIX`;
  - better-auth's secondary storage and rate limits;
  - the pub/sub channel that tells open browser tabs about new notifications and chat messages.
- Losing Redis loses only queued or delayed jobs, which the daily sweeps re-create. It does not lose ledger data.

## 8. Cloudflare

Account: the owner's Cloudflare account (Free plan).

- **DNS for `microbuiltprime.com`:**

  | Name | Type | Points to | Proxy |
  | --- | --- | --- | --- |
  | `microbuiltprime.com` | CNAME (flattened) | Railway `frontend` | **Proxied** (CDN) |
  | `www` | CNAME | Railway `frontend` | **Proxied** (CDN) |
  | `api` | CNAME | Railway `ravishing-light` | **DNS only**: keep it that way; live streams and large uploads break under the proxy's 100 s / 100 MB limits |
  | `_railway-verify`, `_railway-verify.www`, `_railway-verify.api` | TXT | Railway domain ownership | — |
  | `updates`, `send.updates` | MX | Amazon SES (Resend) | — |
  | `resend._domainkey.updates` | TXT | Resend DKIM key | — |
  | `send.updates` | TXT | SPF `v=spf1 include:amazonses.com ~all` | — |
  | `_dmarc` | TXT | `v=DMARC1; p=none;` | — |

- **SSL/TLS:** Full (strict). Cloudflare's edge certificate covers the apex and `*.microbuiltprime.com`; Railway holds the
  origin certificates.
- **CDN caching:**
  - Default rules: `/_next/static/*` (JS, CSS, fonts) and images are cached at the edge (Lagos is the nearest location).
  - HTML pages are not cached, so signed-in pages are always fresh. No custom cache rules are needed.
  - After a deploy, new asset filenames replace the old ones, so there's nothing to purge.
- **Turnstile** ("MicroBuilt support chat", site key `0x4AAAAAAFQ1Eumjaheno9dZ`, Managed mode):
  - Visitors pass it once per new support conversation.
  - Hostnames: `localhost`, `microbuiltprime.com` (covers `www`), and `v2.microbuiltprime.com`, which can be removed now.
  - The secret key is the API's `TURNSTILE_SECRET_KEY`.
- **Workers AI:** the chat guard (`@cf/cloudflare/clef-flash`) and the last fallback reply model.
  - The token is scoped to Workers AI only (`CLOUDFLARE_AI_TOKEN`).
  - The free daily allowance is enough at current traffic. Beyond it needs Workers Paid (~$5/month).

## 9. Namecheap (registrar)

- `microbuiltprime.com` is registered at Namecheap, with WithheldForPrivacy and auto-renew on. The current term ends
  **2027-01-17**.
- Nameservers are **Custom DNS**: `may.ns.cloudflare.com`, `rocco.ns.cloudflare.com`. All records are managed in Cloudflare;
  Namecheap's own DNS settings no longer apply.
- Keep DNSSEC off at Namecheap unless it's first turned on in Cloudflare and the DS record is added here.

## 10. Email, SMS and storage

- **Resend:**
  - It sends every email (sign-in codes, magic links, invites, onboarding, reports, notifications, support summaries)
    from `auth@`, `invite@`, `reports@`, `onboard@` and `notifications@updates.microbuiltprime.com`.
  - The domain `updates.microbuiltprime.com` is verified with the DNS records in §8.
  - Key: `RESEND_API_KEY`. Templates are React Email components in `apps/backend/src/notifications/templates`.
- **Termii (SMS):** phone verification codes and texts. Key: `TERMII_API_KEY`. Without a key, texts are skipped with a
  warning. Phone sign-in on the frontend also needs `NEXT_PUBLIC_PHONE_AUTH`.
- **Supabase Storage** (project `hlvusfvooxvhazayudnt`):
  - Private buckets hold payroll sheets, liquidation proofs and generated files, handed out as signed links. A public
    bucket holds avatars.
  - Only storage is used, not Supabase's database. The API pings it every 3 days so the free project doesn't pause.
  - Key: `SUPABASE_SERVICE_KEY`, which has full access, so keep it on the API only.

## 11. AI chat support (Prime)

- The `/support` page, the Help & support modal and the staff inbox. Design: `apps/backend/docs/CHAT_SUPPORT.md`.
- **Reply chain** (`SUPPORT_CHAIN`, tried in order):

  | Order | Provider | Model |
  | --- | --- | --- |
  | 1 | Google AI Studio | Gemini 3.5 Flash |
  | 2 | Google AI Studio | Gemini 3.1 Flash Lite |
  | 3 | Groq | gpt-oss-120b |
  | 4 | Cerebras | gpt-oss-120b |
  | 5 | Cloudflare Workers AI | Llama 3.3 70B |

  A link without a key is skipped. All of these are free tiers: model IDs change, so check each provider's list now and
  then.
- **Guard:** Cloudflare's Clef checks every message for prompt injection before the reply models see it.
- **Off switch:** set `SUPPORT_ENABLED=false`. The support routes then return 503 and the frontend falls back to email.
- **Hard rules:**
  - The assistant's tools are read-only and masked (`src/support/redact.ts`).
  - IPPIS numbers are never shown.
  - Escalations notify super admins in the app only.
- **Red-team check:** run `pnpm support:eval` against a running API.

## 12. Open items for the next owner

1. **`support@microbuiltprime.com` can't receive mail.**
   - The apex has no MX record, yet the app shows this address to users and in emails.
   - Fix: set up a mailbox and add its MX and SPF records in Cloudflare. Cloudflare Email Routing (free) can forward it to
     an existing inbox.
2. **Retire v1:** delete the Railway service `micro-built` once nothing needs its data. It no longer has a domain but
   still costs money.
3. **Postgres backups:** confirm Railway backups are on and test a restore.
4. **Remove `SEED_SUPERADMIN_PASSWORD`** from the API's Railway variables.
5. **Frontend Sentry:** set `NEXT_PUBLIC_SENTRY_DSN` (and `SENTRY_AUTH_TOKEN` for source maps) on the `frontend` service.
6. **Turnstile:** remove the `v2.microbuiltprime.com` hostname.
7. **DMARC** is `p=none` (monitor only). Move to `p=quarantine` once mail reports look clean.
8. **Office hours** shown on the support page are a placeholder: `apps/frontend/src/lib/support.ts`.

## 13. Accounts to hand over

Transfer ownership, or add the new owner as admin, for each of these:

- GitHub repo `SteffQing/micro-built`
- Namespace (CI runners)
- Railway (workspace "Steve Tomi's Projects", project MicroBuilt Prime)
- Cloudflare (zone `microbuiltprime.com`, Turnstile, Workers AI)
- Namecheap (domain `microbuiltprime.com`)
- Resend
- Termii
- Supabase (project `hlvusfvooxvhazayudnt`)
- Sentry (org `steffqing`)
- Google AI Studio, Groq, Cerebras (AI keys)

Rotate every secret after the handover: `BETTER_AUTH_SECRET` (this signs everyone out), `EDGE_PROXY_SECRET`, and each
provider key.
