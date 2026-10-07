# MicroBuilt API

The backend of MicroBuilt Prime: payroll-deduction loans for Nigerian public servants. NestJS 11, Prisma 6
(PostgreSQL), Redis + Bull queues, better-auth. It is `@microbuilt/backend` in the pnpm monorepo at the repo root.

## Getting started

From the repo root:

```bash
pnpm install                                    # one lockfile for the whole monorepo
cp apps/backend/.env.example apps/backend/.env  # every variable is documented there
pnpm --filter @microbuilt/backend db:deploy     # migrations + prisma/invariants.sql + the SYSTEM admin seed
pnpm --filter @microbuilt/backend start:dev     # http://localhost:3003, Swagger at /docs
```

Or `pnpm dev` at the root to run the shared package, the API and the frontend together.

## Scripts (in `apps/backend`)

| Script | What |
| --- | --- |
| `pnpm start:dev` | Watch mode |
| `pnpm build` / `pnpm start:prod` | `nest build`, then `node dist/main` |
| `pnpm test` | Unit tests (Jest) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:deploy` | `prisma migrate deploy`, the invariants SQL and the seed (Railway runs this before every deploy) |

New migrations: `pnpm exec prisma migrate dev --create-only`, review the SQL, then `pnpm db:deploy`. Never run
`prisma migrate reset`: it drops the database.

## Layout

| Path | What |
| --- | --- |
| `src/ledger` | The money engine: disbursements, top-ups, penalties, payments, deductions, payroll periods, variations |
| `src/admin` | Admin API: loans, customers, repayments, payroll uploads and variations, dashboard, exports |
| `src/user` | Customer API: profile, loan requests, repayments, notifications |
| `src/auth` | better-auth and the global access guard (every route is private unless marked otherwise) |
| `src/notifications` | Email (Resend), SMS (Termii), in-app notifications |
| `src/queue` | Bull queues and the ledger event listeners |
| `prisma/` | Schema, migrations and `invariants.sql` |

## Docs

| File | What |
| --- | --- |
| [`docs/V2.MD`](docs/V2.MD) | The v2 design: data model, money rules, stages |
| [`docs/V2_API_CHANGES.md`](docs/V2_API_CHANGES.md) | Every API change the frontend codes against |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for this codebase |

The live API reference is Swagger, at `/docs` on a running server.
