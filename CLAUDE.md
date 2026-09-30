# CLAUDE.md

MicroBuilt is a pnpm monorepo (branch `v2` on `SteffQing/micro-built`).

| Path | Package | What |
| --- | --- | --- |
| `apps/backend` | `@microbuilt/backend` | NestJS API + Prisma (see `apps/backend/CLAUDE.md`) |
| `apps/frontend` | `@microbuilt/frontend` | Next.js 16 app |
| `packages/shared` | `@microbuilt/shared` | Code both apps use (phone/placeholder-email rules, payroll period labels; better-auth options and the `Auth` type arrive in v2) |

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
- Anything both apps need goes in `packages/shared`, never copied between apps.
- Env files stay per app (`apps/backend/.env`, `apps/frontend/.env.local`) and are never committed.

## v2

The v2 revamp is applied from `apps/backend/V2.MD` and `apps/frontend/V2.MD`, one stage at a time.
Backend API changes for the frontend are logged in `apps/backend/V2_API_CHANGES.md`.

DO NOT USE SUPERPOWER PLUGIN UNLESS CALLED MANUALLY
