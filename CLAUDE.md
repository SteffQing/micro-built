# CLAUDE.md

MicroBuilt is a pnpm monorepo (branch `v2` on `SteffQing/micro-built`).

| Path | Package | What |
| --- | --- | --- |
| `apps/backend` | `@microbuilt/backend` | NestJS API + Prisma (see `apps/backend/CLAUDE.md`). Owns better-auth; its only package export is `@microbuilt/backend/auth-client`, the frontend's typed auth client |
| `apps/frontend` | `@microbuilt/frontend` | Next.js 16 app |
| `packages/shared` | `@microbuilt/shared` | Dependency-free code both apps use (phone/placeholder-email rules, payroll period labels) |

## Commands (run from the repo root)

```bash
pnpm install                                   # one lockfile for everything; builds packages/shared
pnpm dev                                       # shared (watch) + backend + frontend
pnpm --filter @microbuilt/backend <script>     # e.g. start:dev, test, db:deploy
pnpm --filter @microbuilt/frontend <script>    # e.g. dev, build
pnpm --filter @microbuilt/shared test
pnpm build | typecheck | lint | test           # every package, dependencies first
```

- Add a dependency to one app: `pnpm --filter @microbuilt/<app> add <pkg>`. Versions used by more than one
  package go in the `catalog:` of `pnpm-workspace.yaml`.
- Anything both apps need goes in `packages/shared`, never copied between apps — but `packages/shared` takes no
  dependencies: code tied to one side's library (better-auth, Nest, React) stays in that app and is exported from it
  (e.g. `@microbuilt/backend/auth-client`).
- Env files stay per app (`apps/backend/.env`, `apps/frontend/.env.local`) and are never committed.

## v2

The v2 revamp is applied from `apps/backend/docs/V2.MD` and `apps/frontend/docs/V2.MD`, one stage at a time.
Per-organization variations and vouchers (replacing the period-level variation, upload and close rules) follow
`apps/backend/docs/PLAN_V2.md`, on branch `v2-org-variations` until all its stages are done.
AI chat support (the `/support` page, the Help & support modal, the staff inbox) follows `apps/backend/docs/CHAT_SUPPORT.md`
(decisions C1–C14, API contract) and `apps/frontend/docs/CHAT_SUPPORT.md`, on branch `v2-chat-support` until both are done.
Backend API changes for the frontend are logged in `apps/backend/docs/V2_API_CHANGES.md`.

DO NOT USE SUPERPOWER PLUGIN UNLESS CALLED MANUALLY
