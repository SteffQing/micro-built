# Test Files Design — 2026-04-08

## Scope

Fill the existing skeleton spec files for 3 service files in the MicroBuilt NestJS backend. Existing `should be defined` skeletons will be replaced with real test bodies covering happy paths, thrown exceptions, and key branching logic.

## Approach

Focused unit tests for the 3 core services, using mocked dependencies. No utils, guards, or strategy tests in this pass.

## Testing Patterns

- Mock `PrismaService`, `RedisService`, `JwtService`, `EventEmitter2`, `SupabaseService`, and `bcrypt` via `useValue` / `jest.spyOn`.
- Assert that `EventEmitter2.emit` is called with the correct event name and payload (without executing listeners).
- All tests use `jest.fn()`, `@nestjs/testing`, no real DB/Redis/network calls.

---

## Files & Test Plan

### `src/auth/auth.service.spec.ts` (fill existing skeleton)

- `signup`
  - email already exists → `ConflictException`
  - contact already exists → `ConflictException`
  - neither provided → `BadRequestException`
  - success → emits `Auth.userSignUp`, returns `{ message, userId }`
- `login`
  - user not found → `UnauthorizedException`
  - wrong password → `UnauthorizedException`
  - INACTIVE status → `ForbiddenException`
  - success → returns `{ token, user, name }`
- `verifySignupCode`
  - no code in Redis (`get` returns null) → `GoneException`
  - wrong code → `BadRequestException`
  - success → updates user status to `FLAGGED`, deletes Redis key, returns `{ message, userId }`
- `resendCode`
  - user not found → `NotFoundException`
  - success → emits `Auth.userResendCode`
- `forgotPassword`
  - user not found → `NotFoundException`
  - success → emits `Auth.userForgotPassword`
- `resetPassword`
  - invalid/expired token (Redis `get` returns null) → `UnauthorizedException`
  - success → emits `Auth.userResetPassword`

---

### `src/config/config.service.spec.ts` (fill existing skeleton)

- `getValue`
  - numeric key (`INTEREST_RATE`) → returns `parseFloat` of stored string
  - boolean key (`IN_MAINTENANCE`) with value `'true'` → returns `true`; `'false'` → returns `false`
  - array key (`COMMODITY_CATEGORIES`) → splits on `,`, trims, filters empty
  - date key (`LAST_REPAYMENT_DATE`) → returns `Date` instance
  - key not found (prisma returns null) → returns `null`
- `inMaintenanceMode`
  - first call hits Prisma; returns value
  - second call within 5 s TTL → Prisma called only once total (cache hit)
- `toggleMaintenanceMode`
  - current value is `false` → upserts `'true'`, returns `true`
- `topupValue('TOTAL_REPAID', 500)`
  - reads current (e.g. 1000), writes back `1500`
- `depleteValue('BALANCE_OUTSTANDING', 200)`
  - subtracts; result is non-negative
  - when current value < amount, clamps to `0` (never negative)

---

### `src/user/user.service.spec.ts` (fill existing skeleton)

- `getUserById`
  - user not found → `NotFoundException`
  - found → returns the selected user shape
- `updatePassword`
  - user not found → `NotFoundException`
  - old password does not match → `BadRequestException`
  - success → emits `Auth.userUpdatePassword` with `{ password, userId }`
- `getRecentActivities`
  - all data present → aggregates all 5 sources, filters nulls, returns array sorted descending by date
  - identity/paymentMethod null → those entries excluded from result

---

## File Summary

| # | File | Action |
|---|------|--------|
| 1 | `src/auth/auth.service.spec.ts` | Fill skeleton |
| 2 | `src/config/config.service.spec.ts` | Fill skeleton |
| 3 | `src/user/user.service.spec.ts` | Fill skeleton |
