# Better Auth Migration — MicroBuilt

Migration plan for replacing MicroBuilt's hand-rolled JWT auth with [Better Auth](https://better-auth.com), **strictly in JWT (bearer) style**, with **zero forced password resets** and **no downtime**.

These docs assume two repos:

| Repo | Path | Role |
| --- | --- | --- |
| Backend | `/home/sunny/zero/microbuilt/micro-built` | NestJS API — **hosts** Better Auth |
| Frontend | `/home/sunny/zero/microbuilt/micro-built-frontend` | Next.js 16 — Better Auth **client** |

---

## Decisions locked for this migration

| Decision | Choice | Rationale |
| --- | --- | --- |
| Where Better Auth runs | **Embedded in NestJS** (Prisma adapter on the same Postgres DB) | One backend, one `User` table, reuses `PrismaService`, Resend, Redis. Least disruption. |
| Password handling | **Override Better Auth's hasher to use bcrypt(10)** | Existing `bcrypt` hashes validate as-is. Nobody is forced to reset. |
| Scope | **Core parity only** | Replicate today's behaviour (email/contact + password, signup, email verification, forgot/reset, RBAC). No 2FA, no new plugins beyond `jwt` + `bearer`. |
| Token model | **`jwt` plugin (JWKS) + `bearer` plugin** | Frontend keeps a bearer token in storage and sends `Authorization: Bearer …`; NestJS resource routes verify the JWT statelessly via JWKS — matching today's mental model. |

---

## What stays exactly the same

- The `User` table and **all custom columns** (`status`, `role`, `contact`, `externalId`, `repaymentRate`, `accountOfficerId`, `flagReason`, …).
- Custom user IDs (`MB-…` / `AD-…`).
- The `INACTIVE → FLAGGED → ACTIVE` lifecycle and **admin onboarding** (untouched — lives in `AdminModule`).
- `@Roles(...)` + `RolesGuard` — RBAC decorators do not change.
- The role/status **re-fetch from DB on every request** (today done in `JwtStrategy.validate`).
- The frontend axios pattern: bearer token attached by an interceptor, `GET /user` as the "me" call.

## What changes

- New Better Auth tables: `session`, `account`, `verification`, `jwks`.
- `User.password` becomes **nullable** (Better Auth keeps credentials in `account`).
- `User` gains an `emailVerified Boolean` column.
- The old `/auth/*` NestJS controller is **kept running in parallel** during cutover, then removed.
- `JwtStrategy` switches from an HS256 shared-secret check to **JWKS verification** of the Better-Auth-issued JWT.
- The frontend login/signup/reset/verify forms call the Better Auth client instead of the custom `/auth/*` mutations.

---

## Read in this order

| # | File | Covers |
| --- | --- | --- |
| 0 | [00-architecture.md](./00-architecture.md) | Target architecture, token flow diagrams, the two-credential model, gotchas |
| 1 | [01-database-schema-migration.md](./01-database-schema-migration.md) | Prisma schema changes, the 4 new tables, **data backfill** (passwords + emailVerified), rollback SQL |
| 2 | [02-backend-better-auth-setup.md](./02-backend-better-auth-setup.md) | Install, `auth.ts`, mounting inside NestJS, bcrypt hasher, plugins, email handlers, signup/lifecycle hooks |
| 3 | [03-backend-resource-server.md](./03-backend-resource-server.md) | `JwtStrategy` → JWKS, guards, roles, contact-login, deleting old endpoints |
| 4 | [04-frontend-integration.md](./04-frontend-integration.md) | `authClient`, axios JWT wiring, every auth page, route gating |
| 5 | [05-rollout-and-rollback.md](./05-rollout-and-rollback.md) | Phased zero-downtime rollout, parallel run, cutover, monitoring, rollback, cleanup |
| 6 | [06-testing-checklist.md](./06-testing-checklist.md) | Test matrix + env var reference |

> ⚠️ **Two items need an explicit product sign-off before you start** — both are called out in `00-architecture.md`:
> 1. **Email verification UX**: Better Auth's default is a verification *link*; today you send a *6-digit code*. Core-parity recommendation is to switch to the link (no extra plugin). Keeping the 6-digit code requires the `emailOTP` plugin.
> 2. **Contact-only (no-email) users**: Better Auth keys credentials on a unique email. The no-plugin path is a deterministic synthetic email (`<contact>@contact.microbuilt.local`). The clean alternative is the `phoneNumber` plugin (out of scope here).
