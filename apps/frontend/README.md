# MicroBuilt web app

The web app of MicroBuilt Prime, for customers and admins. Next.js 16 (App Router), TanStack Query, shadcn/ui,
Tailwind CSS 4, better-auth (through the typed client `@microbuilt/backend/auth-client`). It is `@microbuilt/frontend`
in the pnpm monorepo at the repo root.

## Getting started

From the repo root:

```bash
pnpm install                                             # one lockfile for the whole monorepo
cp apps/frontend/.env.example apps/frontend/.env.local   # API_ORIGIN, NEXT_PUBLIC_API_URL, Sentry, ...
pnpm --filter @microbuilt/frontend dev                   # http://localhost:3000
```

The app needs the API running (`apps/backend`); `pnpm dev` at the root starts both.

## Scripts (in `apps/frontend`)

| Script | What |
| --- | --- |
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build, then serve it |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

## How it talks to the API

JSON requests go through this app's own origin (`/api/<path>`, rewritten to the API in `next.config.ts`; `/api/auth/*` goes through
`src/proxy.ts`), so the session cookie stays first-party. Uploads go directly to the API. API types live in
`src/types`, queries and mutations in `src/lib/queries` and `src/lib/mutations`.

## Docs

| File | What |
| --- | --- |
| [`docs/V2.MD`](docs/V2.MD) | The v2 frontend plan, stage by stage |
| [`docs/APP_FLOW.md`](docs/APP_FLOW.md) | A walkthrough of the app from entry point to each feature |
| [`../backend/docs/V2_API_CHANGES.md`](../backend/docs/V2_API_CHANGES.md) | The API contract (plus Swagger at `/docs` on the API) |

Deployed on Vercel.
