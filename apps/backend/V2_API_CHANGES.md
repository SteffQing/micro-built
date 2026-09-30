# v2 API changes

What changes in the API between v1 (`main`) and v2, logged by the backend stage that made each change. The frontend
aligns to this file plus Swagger (`/docs`, from backend Stage 5). Paths are API paths: JSON goes through the frontend
origin (`https://microbuiltprime.com/api/<path>`, a Vercel rewrite), uploads and downloads go direct
(`https://api.microbuiltprime.com/<path>`).

## Planned (backend V2.MD §0.6)
Each row moves into its stage's section below, with full request/response detail, when it ships.

| Area | v2 |
|---|---|
| `/auth/*` (signup, login, verify-code, resend-code, forgot/reset-password), `PATCH /user/password` | **Removed** → better-auth `/api/auth/*` |
| `/user`, `/user/*` profile, PPI, notifications, avatar, overview, recent-activity | Kept. `/user` returns `role` (CUSTOMER or Admin.role), `email` (null for placeholders), `phoneNumber`, `image`, `twoFactorEnabled`. Notifications keep `isRead` (derived from `readAt`). |
| `/user/loan*` | Kept. `POST /user/loan` creates a Loan, or a TOPUP request if a DISBURSED loan exists (409 if PENDING/APPROVED exists). Loan DTOs expose `owed, repaid, outstanding, principal, interestBooked, penaltyBooked, tenure, remainingMonths, monthly (OPEN.expected)`. |
| `/user/repayments*` | Kept; `history` filters by `from/to` (YYYY-MM). **New:** `GET /user/loan/liquidation-preview`, `POST /user/repayments/liquidation` (multipart `amount`, `proof`; direct), `GET /user/repayments/liquidations`, `GET /user/statement?from&to&page` (on-screen lines, paginated JSON), `POST /user/statement` and `POST /user/report` (body `{from, to, format}` → 202 `{ jobId }`; the file arrives by notification + email). |
| `/admin` (admins, invite, remove, rate, maintenance, commodities, queues/login) | Kept. `PATCH /admin/rate` upserts the Settings row (partial updates; accepts `maxDeductionRate`). **New:** `GET /admin/commodities`, `PATCH /admin/commodities/:id` (`active`). |
| `/admin/dashboard/*` | Kept paths; `from/to` are YYYY-MM; fields renamed (backend Stage 5). |
| `/admin/customers*`, `/admin/account-officer*` | Kept; `repaymentRate` computed; onboarding DTOs use `phoneNumber`. |
| `/admin/customer/:id/*` | Kept. `request-liquidation` becomes multipart with `proof` (direct). `loan-topup` accepts optional `monthsDelta`. `tenure-changes` lists tenure changes. `loan-statement` returns v2 statement lines. **New:** `POST :id/tenure-changes`, `GET :id/statement?from&to&page` (JSON lines), `POST :id/statement` + `POST :id/report` (`{from, to, format, audience: admin\|customer}` → 202), `GET :id/report-preview?audience=` (JSON preview for the toggle). |
| `/admin/loans/cash*`, `/admin/loans/commodity*` | Kept. **New:** `GET /admin/loans/topups`, `PATCH /admin/loans/topups/:id/approve\|reject\|disburse`. |
| `/admin/repayments*` | Kept: `overview`, list (now payment-inflow rows), `:id`, `upload` (direct), `validate` (direct), `close-period`, `:id/manual-resolution`, `:id/accept-liquidation`, `:id/reject-liquidation`, `:id/proof` (signed URL). |
| `/admin/payroll-variations/*` | Replaced by `GET /admin/payroll-variations?period=YYYY-MM` (preview rows + state), `POST .../generate` (async: file emailed as a draft), `POST .../submit`, `GET .../file?period=` (signed URL). `initialize/backfill/discard/sent/:id/email` removed. |
| `/admin/repayment-obligations/*` | **Removed** → `GET /admin/tenure-changes?status=`, `POST /admin/tenure-changes/:id/approve\|reject` |
| `/webhooks/resend` | **Removed** |
| `/config`, `/config/*` | Kept (reads Settings + commodities; unset rates return `null`). |

## Stage 1 — auth tables and the v2 schema (no route changes yet)
Routes still run v1 code until Stage 5 rewires them, so nothing the API serves has changed yet. The data they will
expose has:

- **User** is now better-auth's user:
  - `contact` → `phoneNumber`, always `+234XXXXXXXXXX`; verified by SMS code (`phoneNumberVerified`).
  - `avatar` → `image`.
  - `email` is always set in the database: phone-only users hold a placeholder (`<digits>@phone.microbuiltprime.com`)
    that the API returns as `email: null` and never mails. A real email replaces it through better-auth's email change.
  - New: `emailVerified`, `twoFactorEnabled`.
  - No `password` on the user (better-auth keeps it in its `account` table). Sign-up, sign-in, verification codes and
    password reset move to `/api/auth/*` (backend Stage 4); the old `/auth/*` routes go away.
  - Self sign-ups start `FLAGGED` (v1: `INACTIVE` until the email code); `INACTIVE` now only means deactivated, and
    deactivated users can't sign in.
- **Tenure extensions become tenure changes:** `addedMonths` → `monthsDelta` (signed: a change can shorten a loan),
  plus `reason` (`DEFAULT | TOPUP | LIQUIDATION | ADMIN`) and `status` (`PENDING | APPROVED | REJECTED`); a TOPUP change
  is tied to its top-up. At most one pending change per loan.
- **Settings:** `interestRate`, `managementFeeRate` and `penaltyRate` can be `null` (not set yet — a super admin sets
  them on the dashboard); new `maxDeductionRate` (largest share of net pay a monthly deduction may take; `null` = no cap).
- **Top-ups:** status `PENDING → APPROVED → DISBURSED`, or `REJECTED`.
- **Commodity requests** get a `status`: `IN_REVIEW | APPROVED | REJECTED`.
- **Liquidations** always carry a proof file (stored privately, served as a short-lived signed URL). A rejection's
  reason is recorded in the audit log, not on the liquidation.
- **Audit log actions:** `EXTENSION_*` → `TENURE_CHANGE_PROPOSED / APPROVED / REJECTED`; new `COMMODITY_APPROVED`,
  `COMMODITY_REJECTED`, `CUSTOMER_STATUS_CHANGED`, `ADMIN_INVITED`, `ADMIN_REMOVED`, `PAYROLL_UPLOADED`.
- **Typed auth client:** the backend exports `@microbuilt/backend/auth-client` (`authClientOptions`, `AuthSession`,
  `AuthUser`) for the frontend's `createAuthClient` (frontend Stage 4).

## Stage 2 — settings, commodities, removed routes
Rates are percentages everywhere in the API (6 = 6 %), as in v1.

- **`GET /config`**: same shape (`maintenanceMode`, `interestRate`, `managementFeeRate`, `penaltyFeeRate`,
  `commodities`), but an unset rate is `null` (v1: `0`). New field `maxDeductionRate` (percent of net pay; `null` = no
  cap). `commodities` lists active commodity names only.
- **`GET /config/interest-rate`, `/config/management-fee-rate`**: `data` is `null` until set (v1: `0`).
  `/config/commodities` and `/config/maintenance-mode` unchanged.
- **`PATCH /admin/rate`** (SUPER_ADMIN): body changed from `{ key, value }` to any of
  `{ interestRate?, managementFeeRate?, penaltyRate?, maxDeductionRate? }` — percentages with up to 2 decimals, 0–100
  (the cap 1–100, or `null` to switch it off); rates can't be set back to `null`. An empty body is 400. Returns the
  settings: `data: { interestRate, managementFeeRate, penaltyRate, maxDeductionRate, inMaintenance }` (v1: `null`).
- **`PATCH /admin/maintenance`**: unchanged (toggles).
- **Commodities** (ADMIN and SUPER_ADMIN; v1: SUPER_ADMIN):
  - **New** `GET /admin/commodities` → `data: [{ id, name, active, createdAt }]` (inactive ones included).
  - `POST /admin/commodities` `{ name }` → 200 with the saved commodity (`data`, v1: `null`); the name is saved in
    Title Case; a name that exists in any case → 409 "`<Name>` already exists".
  - **New** `PATCH /admin/commodities/:id` `{ active }` → the commodity; 404 if unknown. Inactive commodities are
    hidden from customers but stay on existing asset loans.
  - **Removed** `DELETE /admin/commodities` — commodities are never deleted; set `active: false` instead.
- **Removed:** `/webhooks/resend`, `/admin/repayment-obligations/*`.
- Errors that aren't HTTP errors (the 500s) are reported to Sentry; 4xx responses are not.
