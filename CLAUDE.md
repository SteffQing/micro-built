# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm start:dev        # watch mode
pnpm start:debug      # debug + watch mode

# Build & production
pnpm build
pnpm start:prod       # runs dist/main

# Testing
pnpm test                        # all unit tests
pnpm test:watch                  # watch mode
pnpm test:cov                    # coverage report
pnpm test:e2e                    # end-to-end tests
npx jest path/to/file.spec.ts    # single test file

# Code quality
pnpm lint     # ESLint with auto-fix
pnpm format   # Prettier

# Prisma
npx prisma generate              # regenerate client after schema change
npx prisma migrate dev           # create + apply migration
npx prisma studio                # GUI for the database
```

## Architecture Overview

NestJS REST API for **MicroBuilt** — an asset-based and cash-based loan management platform. Swagger docs are served at `/api`; BullBoard queue monitor at `/queues` (JWT-protected).

### Module Map

| Module               | Path                | Responsibility                                                                                         |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `AuthModule`         | `src/auth`          | JWT signup/login/password reset; `MaintenanceGuard` (global); `RolesGuard`; BullBoard auth middleware  |
| `UserModule`         | `src/user`          | Customer profile, PPI (identity/payroll/payment method), loan requests, repayment view                 |
| `AdminModule`        | `src/admin`         | Loan approval/disbursement, customer onboarding, repayment management, dashboard, marketer flows       |
| `QueueModule`        | `src/queue/bull`    | BullMQ producers & consumers — four named queues: `repayments`, `reports`, `services`, `maintenance`   |
| `EventsModule`       | `src/queue/events`  | `@nestjs/event-emitter` listeners that fan out business events to notifications, DB writes, queue jobs |
| `NotificationModule` | `src/notifications` | Mail (Resend), SMS, in-app notifications                                                               |
| `DatabaseModule`     | `src/database`      | `PrismaService`, `RedisService` (ioredis + Upstash), `SupabaseService`                                 |
| `ConfigModule`       | `src/config`        | Runtime app configuration backed by `Config` Prisma table                                              |

### Data Flow Pattern

Business actions follow a consistent two-step async pattern:

1. **Controller → Service** — validates input, writes to DB if needed, emits a named event via `EventEmitter2`
2. **EventsModule listener** — handles the event: sends notifications, queues background jobs, triggers further DB updates

Event names live in `src/queue/events/events.ts` (enums: `Auth`, `UserEvents`, `AdminEvents`, `CustomerPPIEvents`).  
Queue job names live in `src/common/types/queue.interface.ts` (enums: `RepaymentQueueName`, `ReportQueueName`, `ServicesQueueName`, `MaintenanceQueueName`).

### Authentication & Authorization

- JWT tokens are extracted from `Authorization: Bearer <token>` headers.
- `JwtStrategy` (`src/auth/jwt.strategy.ts`) validates the token **and** re-fetches the user's current role from DB on every request.
- Role-based access uses `@Roles(...)` decorator + `RolesGuard` (`src/auth/roles.guard.ts`). Roles: `SUPER_ADMIN`, `ADMIN`, `MARKETER`, `CUSTOMER`.
- `MaintenanceGuard` is registered globally as `APP_GUARD` and can block all requests when maintenance mode is on.

### User Lifecycle

`INACTIVE` → (email verification code) → `FLAGGED` → (admin onboards customer) → `ACTIVE`

Users without email (contact-only) skip email verification and go straight to `FLAGGED`.

### Database

- **PostgreSQL** via Prisma (`prisma/schema.prisma`). Key models: `User`, `Loan`, `CommodityLoan`, `Repayment`, `LiquidationRequest`, `UserIdentity`, `UserPayroll`, `UserPaymentMethod`, `Notification`, `Config`.
- **Redis** (Render/Upstash) serves two roles: BullMQ broker and key-value store for ephemeral data (verification codes at `verify:<email>`, password reset tokens at `reset:<hashedToken>`).
- **Supabase** is used for file/object storage.

### Required Environment Variables

```
DATABASE_URL
JWT_SECRET
REDIS_URL
RENDER_REDIS_TCP
RENDER_REDIS_USERNAME
RENDER_REDIS_TOKEN
```

Plus Resend API key, SMS provider credentials, and Supabase keys (check service constructors for exact names).

DO NOT USE SUPERPOWER PLUGIN UNLESS CALLLED MANUALLY
