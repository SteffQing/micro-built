# Test Files Design — 2026-04-08

## Scope

Create meaningful spec files for 12 important source files in the MicroBuilt NestJS backend. Existing skeleton specs (just `should be defined`) are treated as missing and will be replaced with real test bodies.

## Approach

**Balanced (Approach C):** Comprehensive tests for all 5 pure utilities (100% deterministic, trivial setup), and focused unit tests for 7 NestJS files covering happy paths + all thrown exceptions + key branching logic.

## Testing Patterns

- **Pure utilities** — import and call directly, no NestJS module setup needed.
- **Guards** — mock `ExecutionContext` via `switchToHttp().getRequest()`, inject mock dependencies with `useValue`.
- **JWT Strategy** — mock `AuthService.isValidUser`, call `validate()` directly.
- **Services** — mock `PrismaService` and all injected deps via `useValue`; mock `EventEmitter2.emit` to assert events are fired without executing listeners.
- All tests use `jest.fn()`, `@nestjs/testing`, no real DB/Redis/network calls.

---

## Files & Test Plan

### Pure Utilities

#### `src/common/utils/generate-code.spec.ts` (new)
- `resetToken()` — returns object with `resetToken` (hex string) and `hashedToken` (SHA-256 of it); two calls produce different tokens.
- `hashToken(token)` — deterministic: same input → same SHA-256 output.
- `sixDigitCode()` — string of length 6, numeric only, value in range [100000, 999999].
- `generatePassword(length)` — output length matches input; contains at least one upper, lower, digit, symbol.

#### `src/common/utils/generate-id.spec.ts` (new)
- `userId()` — starts with `MB-`, total length 8.
- `adminId()` — starts with `AD-`, total length 8.
- `loanId()` — starts with `LN-`, total length 9.
- `repaymentId()` — starts with `RP-`, total length 9.
- `assetLoanId()` — starts with `CLN-`, total length 10.
- `liquidationRequestId()` — starts with `LR-`, total length 9.
- `anyId()` — defaults to `ANY-` prefix; custom prefix respected.

#### `src/common/utils/strings.spec.ts` (new)
- `enumToHumanReadable('LOAN_STATUS')` → `'Loan Status'`
- `enumToHumanReadable('PERSONAL')` → `'Personal'`
- `formatDateToDmy(new Date('2026-01-05'))` → `'5-Jan-2026'`
- `formatCurrency(5000)` → contains `'₦'` and `'5,000'`
- `formatCurrency(null)` → formats `0`
- `formatDateToReadable('2026-06-15')` → contains `'Jun'` and `'2026'`

#### `src/user/common/utils/name-verification.spec.ts` (new)
- 2+ tokens match (e.g. `'Ada Lovelace'` vs `'Ada Grace Lovelace'`) → `true`
- Exactly 1 token match → `false`
- Case-insensitive matching → `true`
- Punctuation in either name is stripped → `true`
- Completely different names → `false`

#### `src/user/common/utils/activity.spec.ts` (new)
- `summarizeActivity('User', ...)` — `createdAt === updatedAt` → "account was created"; `updatedAt` later → "Profile updated"
- `summarizeActivity('UserIdentity', ...)` — created path vs updated path descriptions
- `summarizeActivity('UserPaymentMethod', ...)` — added vs updated bank name in description
- `summarizeActivity('Loan', ...)` — created (pending), status update (no disbursementDate), DISBURSED, REPAID branches
- `summarizeActivity('Repayment', ...)` — includes `repaidAmount` and `loanId`
- `summarizeActivity('Unknown', ...)` — returns default "Unknown Activity"

---

### Guards / Strategy

#### `src/auth/maintenance.guard.spec.ts` (new)
- GET request → returns `true` immediately (no config call)
- Non-GET + `bypassMaintenance = true` → returns `true` (no config call)
- Non-GET + maintenance OFF → returns `true`
- Non-GET + maintenance ON → throws `ServiceUnavailableException`
- Cache hit (second call within TTL) → `inMaintenanceMode` called only once for two consecutive non-GET requests

#### `src/auth/roles.guard.spec.ts` (new)
- No `@Roles` decorator on handler → allow (returns `true`)
- User role matches one of the required roles → allow
- User role does not match any required role → deny (returns `false`)

#### `src/auth/jwt.strategy.spec.ts` (new)
- Valid payload, `isValidUser` returns active role → returns `{ userId, email, role, contact }`
- `isValidUser` throws `NotFoundException` → propagates
- `isValidUser` throws `UnauthorizedException` (INACTIVE) → propagates

---

### Services

#### `src/auth/auth.service.spec.ts` (fill existing skeleton)
- `signup`: email already exists → `ConflictException`; contact already exists → `ConflictException`; neither provided → `BadRequestException`; success → emits `Auth.userSignUp`, returns `{ message, userId }`
- `login`: user not found → `UnauthorizedException`; wrong password → `UnauthorizedException`; INACTIVE status → `ForbiddenException`; success → returns `{ token, user, name }`
- `verifySignupCode`: no code in Redis → `GoneException`; wrong code → `BadRequestException`; success → updates user status, deletes Redis key
- `resendCode`: user not found → `NotFoundException`; success → emits `Auth.userResendCode`
- `forgotPassword`: user not found → `NotFoundException`; success → emits `Auth.userForgotPassword`
- `resetPassword`: invalid/expired token → `UnauthorizedException`; success → emits `Auth.userResetPassword`

#### `src/config/config.service.spec.ts` (fill existing skeleton)
- `getValue('INTEREST_RATE')` → parses to float; `getValue('IN_MAINTENANCE')` → parses to bool; `getValue('COMMODITY_CATEGORIES')` → splits to array; `getValue('LAST_REPAYMENT_DATE')` → returns Date; unknown key returns `null`
- `inMaintenanceMode()` — first call hits DB; second call within TTL returns cached value without DB call
- `toggleMaintenanceMode()` — flips from false to true (upserts `'true'`)
- `topupValue('TOTAL_REPAID', 500)` — reads current, adds 500, writes back
- `depleteValue('BALANCE_OUTSTANDING', 200)` — subtracts; never goes below 0

#### `src/user/user.service.spec.ts` (fill existing skeleton)
- `getUserById`: not found → `NotFoundException`; found → returns user shape
- `updatePassword`: user not found → `NotFoundException`; old password invalid → `BadRequestException`; success → emits `Auth.userUpdatePassword`
- `getRecentActivities`: aggregates user + identity + paymentMethod + loans + repayments, filters nulls, returns sorted desc by date

#### `src/user/ppi.service.spec.ts` (new)
- `submitVerification`: identity already exists → `BadRequestException`; success → emits `CustomerPPIEvents.userCreateIdentity`
- `updateVerification`: no existing identity → `NotFoundException`; success → emits event
- `addPaymentMethod`: payment method already exists → `ConflictException`; account name mismatch → `UnprocessableEntityException`; success → emits event
- `updatePaymentMethod`: name provided but mismatch → `UnprocessableEntityException`; no existing payment method → `NotFoundException`; success → emits event
- `createPayroll`: `externalId` already set → `ConflictException`; success → emits event
- `updatePayroll`: user not found or no externalId → `NotFoundException`; success → emits event

---

## File Summary

| # | File | Action |
|---|------|--------|
| 1 | `src/common/utils/generate-code.spec.ts` | Create new |
| 2 | `src/common/utils/generate-id.spec.ts` | Create new |
| 3 | `src/common/utils/strings.spec.ts` | Create new |
| 4 | `src/user/common/utils/name-verification.spec.ts` | Create new |
| 5 | `src/user/common/utils/activity.spec.ts` | Create new |
| 6 | `src/auth/maintenance.guard.spec.ts` | Create new |
| 7 | `src/auth/roles.guard.spec.ts` | Create new |
| 8 | `src/auth/jwt.strategy.spec.ts` | Create new |
| 9 | `src/auth/auth.service.spec.ts` | Fill skeleton |
| 10 | `src/config/config.service.spec.ts` | Fill skeleton |
| 11 | `src/user/user.service.spec.ts` | Fill skeleton |
| 12 | `src/user/ppi.service.spec.ts` | Create new |
