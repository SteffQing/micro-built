# v2 API changes

What changes in the API between v1 (`main`) and v2, logged by the backend stage that made each change. The frontend
aligns to this file plus Swagger (`/docs`, from backend Stage 5). Paths are API paths: JSON goes through the frontend
origin (`https://microbuiltprime.com/api/<path>`, a Vercel rewrite), uploads and downloads go direct
(`https://api.microbuiltprime.com/<path>`).

## Planned (backend V2.MD §0.6)
Everything planned in §0.6 has shipped (Stages 2–6); each stage's section below has the detail.

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

## Stage 4 — better-auth
- **Auth lives under `/api/auth/*` (better-auth).** Removed: `/auth/signup`, `/auth/login`, `/auth/verify-code`,
  `/auth/resend-code`, `/auth/forgot-password`, `/auth/reset-password`. Use the typed client
  (`@microbuilt/backend/auth-client`); the endpoint reference is `/api/auth/reference`.
- **Sessions are cookies** (`better-auth.session_token`, `Domain=microbuiltprime.com` in production), not bearer JWTs
  in localStorage. A sign-in response also carries `set-auth-token` for tools (Swagger, Postman):
  `Authorization: Bearer <token>`.
- **Every route needs a session** unless it is public: `/`, `/config*`, `/api/auth/*`, `/docs`. No session → 401
  `Sign in to continue`.
- **Admins without 2FA get 403 `{ statusCode: 403, code: "TWO_FACTOR_SETUP_REQUIRED", message }` on every route except
  `GET /user`** until they turn 2FA on (release blocker). Deactivated (`INACTIVE`) users: 403 on every route and no
  new sessions.
- **Admins sign in with password + 2FA only.** For an admin's email, `POST /api/auth/sign-in/magic-link` and
  `POST /api/auth/email-otp/send-verification-otp` (`type: "sign-in"`) answer 403 "Admins sign in with password and
  2FA" and send nothing; admin sessions from codes or passkeys are refused with the same message; admins can't
  register passkeys or turn 2FA off (403 "Admins must keep two-factor authentication on").
- **Codes:** email and SMS codes expire in 10 minutes, 2FA codes in 5, magic links in 10, reset links in 60. Phone
  numbers are accepted as `080…`, `234…` or `+234…` everywhere and stored as `+234…`. A password reset signs the
  account out everywhere.
- `GET /admin/queues/login` no longer sets a cookie: `/queues` reads the session itself (super admins with 2FA).
- `GET /task` (queue internals) now requires a super admin.
- Swagger moved from `/api` to `/docs`.

## Stage 5 — every module on the v2 ledger
Every route now runs on the v2 schema. Swagger (`/docs`) has the full shapes; this section lists what changed.

**Across the API**
- Money is a JSON number in naira (2 dp). Payroll months are `YYYY-MM` in queries and bodies and labels
  (`"JUNE 2026"`) in responses. A `from` after `to` is 400 "`from` must not be after `to`".
- Loans carry the same figures everywhere ("loan figures"): `owed, repaid, outstanding, principal, interestBooked,
  penaltyBooked, tenure, remainingMonths, monthly` (`monthly` = this month's deduction, `null` when none is open).
- `contact` → `phoneNumber` and `avatar` → `image` in every response and body. `email` is `null` for phone-only
  customers.
- An unknown id is 404 everywhere (several v1 routes answered 200 with `data: null`). Decisions that someone else
  already made answer 409 "Already decided by another admin".
- Approve / reject / disburse routes return the updated record (v1: `{ userId }`).
- Default page size is 20.
- Files (exports, reports, variation drafts) are no longer email attachments: they go to a private bucket and arrive as a
  7-day download link in-app, plus by email when the person has a real address.

### Customer (`/user…`, any signed-in user unless noted)
- **`GET /user`** (also reached by admins without 2FA): `{ id, name, email|null, phoneNumber, image, role (CUSTOMER or
  the admin's role), type, status, twoFactorEnabled, externalId, flagReason, accountOfficer {id,name}|null,
  createdAt }`; the last three are null for admins.
- **Removed** `PATCH /user/password` → better-auth `POST /api/auth/change-password`.
- `POST /user/avatar` (multipart `file`, image ≤ 3 MB) → `{ url }`.
- `GET /user/overview` → `{ currentLoan (loan figures + id, category, status, disbursementDate, createdAt)|null,
  repaymentRate, pendingLoanRequestsCount, pendingRequests {loans, topups, commodities}, lastDeduction {amount, date,
  period, source}|null, nextDeduction {amount, period}|null }`. Removed `activeLoans`, `nextRepaymentDate`.
- `GET /user/recent-activity` → up to 20 `{ title, description, date, source }`, `source` one of User, UserIdentity,
  UserPaymentMethod, Loan, Topup, Penalty, Commodity, Repayment, Liquidation.
- PPI: `GET /user/identity | payment-method | payroll` → the record or `null`. Payroll is `{ externalId, netPay,
  employeeGross, grade, step, command, organization }`; payment method `{ bankName, accountNumber, accountName }`.
  Every PPI write flags the account for review (`status FLAGGED` + reason, as v1). Admins get 403 "Only customer
  accounts can add these details".
  - `POST /user/payroll` `{ externalId, command, organization, grade?, step? }` sets the IPPIS number; 409 "This IPPIS
    number is already registered to another customer", "Payroll info already exists. Update instead", "Your IPPIS
    number is already on file as X. Contact support to change it." `PATCH /user/payroll` can't change the IPPIS number.
  - `POST /user/payment-method` `{ bankName, accountNumber, accountName, bvn }`: 409 "A payment method already exists
    for this user.", "This account number is already linked to another customer", "This BVN is already linked to
    another customer"; 422 when the account name doesn't match. `PATCH` has the same 409s/422.
- Notifications: `GET /user/notifications?page&limit` → `{ notifications [{ id, title, description, callToActionUrl,
  isRead, readAt, createdAt }], unreadCount }` + `meta`; `PATCH /user/notifications/mark-read`, `PATCH
  /user/notifications/:id/read` → `null`.
- **`POST /user/loan`** `{ amount, category? }` → `{ kind: LOAN|TOPUP, id, loanId }`. With a running loan it is a
  top-up request (category ignored); otherwise a new PENDING loan (category required, not ASSET_PURCHASE: 400 "Choose
  a loan category"). 409 "You already have a loan request in progress", "This loan already has a top-up waiting for a
  decision"; 400 for a restricted (FLAGGED) account; 403 "Only customer accounts can request loans".
- **`POST /user/loan/commodity`** `{ assetName }` (an active commodity, any letter case; 400 "Only commodities in stock
  can be requested.") → `{ kind, id (the asset request), loanId }`. On a running loan it is an asset top-up request.
  409 in progress / "You already have an asset request in review" / top-up waiting / "This loan is not active".
- `GET /user/loan/overview` → `{ pendingLoans [{id, amount, category, status, date}], pendingTopups, commoditiesInReview,
  rejectedCount, approvedCount, disbursedCount, repaidCount }`.
- `GET /user/loan/all?page&limit` → `[{ id, kind: LOAN|TOPUP|COMMODITY, loanId, amount|null, category, status,
  name|null, date }]`.
- `GET /user/loan?page&limit&status` → loan figures + `{ id, category, status, assetName|null, disbursementDate,
  createdAt }`; `GET /user/loan/:loanId` adds `updatedAt`, `topups [{ id, amount, status, requestedAt, disbursedAt,
  tenureChange {monthsDelta, status}|null }]`, `commodities`. v1 `amount, assetId, penalty, extension` are gone.
- `GET /user/loan/commodity`, `GET /user/loan/commodity/:cLoanId` → `{ id, loanId, name, status (IN_REVIEW|APPROVED|
  REJECTED; was `inReview`), kind: NEW_LOAN|TOPUP, amount|null, details (public details only), date }`.
- `PUT /user/loan/:loanId` `{ amount?, category? }` and `DELETE /user/loan/:loanId` → `null`, only while PENDING (409
  "Only loan requests still pending can be changed or deleted"; was 400). An asset loan can't be edited (409); deleting
  it removes its asset request.
- **`GET /user/repayments?page&limit`** is now the repayment list (was the yearly chart, `?year=`): `[{ id, loanId,
  amount, date, period, source: PAYROLL|LIQUIDATION, expected|null, deductionStatus|null }]` (v1 `repaid, status,
  penaltyCharge` gone).
- `GET /user/repayments/overview` → `{ totalRepaid, outstanding, repaymentsCount, missedCount, thisMonth {amount,
  period}|null, lastRepayment {amount, date, period, source}|null, chart [12 × {period, amount}] }`. Removed
  `flaggedRepaymentsCount, nextRepaymentDate, activeLoans`.
- `GET /user/repayments/history?from&to&page&limit` (YYYY-MM; `status` removed) → the list rows. `GET
  /user/repayments/:id` → one row, 404 when unknown.
- `GET /user/exports/repayments | loans` → the file arrives in-app (+ email); only the customer's own records.

### Admins (`/admin`, SUPER_ADMIN)
- `GET /admin` → `[{ id, avatar, name, role, email, status }]`; removed admins stay listed as INACTIVE; the system
  account is hidden.
- `POST /admin/invite-admin` `{ email, name, role: ADMIN|SUPER_ADMIN|MARKETER }` → `null`. A removed admin's email
  re-activates them with the new role and a new password (2FA set up again). Any other existing account → 409 "That
  email already has an account". If the invite email fails, the message says so (they can reset their password).
- `PATCH /admin/remove-admin` `{ id }` → the admin is deactivated and signed out everywhere (v1 turned them into a
  flagged customer). 400 removing yourself or the system account; 409 "This admin has already been removed", "There
  must always be one active super admin: invite another before removing this one".

### Customers (`/admin/customers`, `/admin/account-officer`)
- `GET /admin/customers` (ADMIN, SUPER_ADMIN): `page, limit, search` (name, email, phone, customer id, IPPIS), `status,
  signupStart, signupEnd, repaymentRateMin, repaymentRateMax` (0–100), `hasActiveLoan, grossPayMin, grossPayMax,
  netPayMin, netPayMax, accountOfficerId` (`microbuilt-system-id` = self sign-ups), `organization` → `[{ id, name,
  email|null, phoneNumber|null, externalId|null, status, repaymentRate }]`. `repaymentRate` is computed from closed
  payroll months (100 when nothing was due yet).
- `GET /admin/customers/overview` → same fields as v1; `defaultedCount / flaggedCount / ontimeCount` come from the
  latest closed payroll month, each borrower counted once by their worst deduction (all 0 until a month is closed).
- `GET /admin/customers/organizations` (+ MARKETER) → `[{ id, name }]`.
- `POST /admin/customers` (+ MARKETER): `user { name, email?, phoneNumber? }` (at least one), `payroll { externalId,
  grade?, step?, command, organization }`, `identity`, `paymentMethod { bankName, accountNumber (10 digits), accountName,
  bvn (11 digits) }`, optional `loan { category, cashLoan? {amount, tenure}, commodityLoan? {assetName} }` → 201
  `{ userId, loanId|null, commodityLoanId|null }`. A cash loan starts APPROVED at the current rates (409 "Set rates in
  Settings first" until they are). Duplicates are 409 (was 400). Customers with an email get the password by email;
  phone-only customers get an SMS telling them to sign in with their phone number.
- `POST /admin/customers/upload-existing` (SUPER_ADMIN): the sheet needs a PHONE NUMBER column; the import runs in the
  background and the uploader gets a summary (in-app + email). Loans already paid off are not imported.
- `GET /admin/account-officer` → `[{ id, name, role, status|null, customersCount, isSystem }]` (first row = self
  sign-ups). `GET /admin/account-officer/me` and `/:id/customers` take every customer-list filter. `GET
  /admin/account-officer/:id/stats` → `{ customers {total, active, inactive, flagged, avgRepaymentScore}, portfolio
  {totalLoans, totalDisbursed, totalRepaid, totalPenalty, outstandingBalance} }`.

### Customer page (`/admin/customer/:id/*`, ADMIN, SUPER_ADMIN, MARKETER)
- `GET :id` → `{ id, name, email|null, phoneNumber, image, status, flagReason, externalId, repaymentRate,
  accountOfficer|null, createdAt }`.
- `GET :id/loans` → `{ activeLoans, applications [{ recordType: LOAN|TOPUP|COMMODITY_REQUEST, detailsId, loanId, kind:
  NEW_LOAN|TOPUP, category, status, amount|null, tenure|null, date, asset }], pendingLoans, approvedLoans }`.
- `GET :id/summary` → `{ totalBorrowed, totalLoanAmount, totalDisbursed, managementFee, interestBooked,
  interestCollected, penaltyCharged, penaltyCollected, totalRepaid, outstanding, activeLoansCount, pendingLoansCount,
  repaymentRate, lastRepaymentDate, lastRepaymentPeriod }` (renamed `interestEarned, interestReceived,
  totalPenalties, penaltiesReceived`; `currentOverdue` removed).
- `GET :id/topups?search&status&page&limit` → `[{ id, recordType: TOPUP|ASSET_REQUEST, loanId, amount|null, status,
  requestedAt, disbursedAt, asset|null, tenureChange|null }]`.
- `GET :id/tenure-changes?status&page&limit` → `[{ id, loanId, previousTenure, monthsDelta, loanTenure, reason, status,
  topupId, requestedBy|null, createdAt }]`.
- `GET :id/loan-statement?from&to&page&limit` → `{ from, to, opening, debits, credits, closing, lines }` + `meta`
  (default: first disbursement month to this month).
- `GET :id/repayments?from&to&state&source&page&limit` → payments received `[{ id, source, state, period, amount,
  applied, loanId|null, split|null, expected|null, deductionStatus|null, createdAt }]`.
- `GET :id/ppi-info` → `{ payroll|null, identity|null, paymentMethod|null }`; `GET :id/payment-method | identity |
  payroll`.
- `PATCH :id/status` `{ status, reason? }`: FLAGGED needs a reason; ACTIVE and INACTIVE are SUPER_ADMIN only (403, was
  400); INACTIVE signs the customer out everywhere.
- `POST :id/message` `{ title, message }`; `GET :id/liquidation-requests?state&page&limit` → `[{ id, amount, state,
  requestedAt, hasProof }]`.
- `POST :id/generate-report` — replaced in Stage 6 by `POST :id/report` (see below).
- `GET :id/active-loan` → the running loan (loan figures + `id, category, status, disbursementDate`) or `null`.
- `POST :id/loan-topup` `{ category, cashLoan?, commodityLoan?, monthsDelta? }` → `{ kind: CASH|ASSET, loanId,
  topupId|null, commodityLoanId|null }`. A cash top-up is now only **requested** — approve it under
  `/admin/loans/topups`. A MARKETER can top up only customers they onboarded.
- `POST :id/request-liquidation` — back in Stage 6 as multipart with proof (see below).

### Loans (`/admin/loans/*`, ADMIN and SUPER_ADMIN; disburse SUPER_ADMIN)
- `GET /admin/loans/cash`: `page, limit, search, status, category, principalMin/Max, hasPenalties, hasCommodityLoan,
  disbursementStart/End, requestedStart/End` (`type` removed) → loan figures + `{ id, category, status,
  disbursementDate, date, customer {id, name, externalId} }` (v1 `amount, amountRepaid, penalty, loanTenure` →
  `principal, repaid, penaltyBooked, tenure`).
- `GET /admin/loans/cash/:id` (any loan, cash or asset) → loan figures + `{ id, category, status, disbursementDate,
  interestRate, managementFeeRate, managementFee, createdAt, updatedAt, borrower {id, name, externalId, email,
  phoneNumber}, requestedBy, assets [{id, name, status, kind}], topups [...] }`.
- `PATCH :id/approve` `{ tenure }` (1–120) fixes the loan's rates from Settings; 409 "Set rates in Settings first",
  "Approve an asset loan from its asset request", "Only a pending loan can be approved". `PATCH :id/reject` `{ note? }`.
  `PATCH :id/disburse` disburses cash **and** asset loans; 400 for a flagged or deactivated customer.
- `GET /admin/loans/commodity`: `page, limit, search, status, inReview, requestedStart/End` → `[{ id, date, customer,
  name, status, inReview, kind: NEW_LOAN|TOPUP, amount|null, loanId, loanStatus }]`; `GET :id` adds `publicDetails,
  privateDetails, topup, borrower, loan`.
- `PATCH /admin/loans/commodity/:id/approve` `{ publicDetails, privateDetails, amount, tenure?, monthsDelta? }` (the
  rate fields are gone): a new asset loan needs `tenure` and is then disbursed with `cash/:id/disburse`; on a running
  loan it becomes an approved top-up (disburse under `topups`). `PATCH :id/reject` `{ note? }`.
- **New** `GET /admin/loans/topups?status&page&limit` → `[{ id, loanId, customer, amount, status, requestedAt,
  disbursedAt, tenureChange|null, asset|null }]`; `PATCH /admin/loans/topups/:id/approve`, `/reject` `{ note? }`,
  `/disburse` (SUPER_ADMIN).

### Repayments (`/admin/repayments/*`, ADMIN and SUPER_ADMIN unless noted)
- `POST /admin/repayments/upload` (SUPER_ADMIN, direct) multipart `file` (.xlsx/.xls ≤ 10 MB) + `period?` → 201
  `{ uploadId, period, rows }`; processed in the background. Every row must be for one month (400 lists the rows that
  aren't). 409 "Submit the JUNE 2026 variation before uploading its payroll", "JUNE 2026 is closed, so its payroll can
  no longer be uploaded", "This file has already been uploaded".
- `POST /admin/repayments/validate` (SUPER_ADMIN, direct) → 200 `{ valid, period, rows, missingColumns, problems,
  invalidRows [{ row, staffId, issues }] }` (row numbers as in the sheet).
- `GET /admin/repayments` lists **payments received** (one per payroll row or liquidation): `page, limit, search, state,
  source, from, to, amountMin, amountMax, customerId, uploadId` → `[{ id, source, state (AWAITING|SETTLED|REVIEWING|
  UNMATCHED|REJECTED), amount, applied, period, customer {id, name, externalId}|null, externalUserId, uploadId,
  hasProof, createdAt }]`.
- **New** `GET /admin/repayments/deductions` (declared before `:id`): what each loan is expected to pay per payroll month,
  newest month first. Query `page, limit, period` (one month, YYYY-MM; wins over `from, to`), `from, to, status`
  (OPEN|AWAITING|FULFILLED|PARTIAL|FAILED), `search` (customer name/email/phone/id/IPPIS, or loan id), `customerId` →
  `[{ id, loanId, period {ym, label}, customer {id, name, externalId}, expected, paid, outstanding, status, settledAt,
  penalizedAt }]` + `meta { total, page, limit }`.
- **New** `GET /admin/repayments/applied`: payments applied to loans (one per payment that reached a loan), newest first.
  Query `page, limit, period, from, to, search, customerId, loanId` (the month is the payment's payroll month) →
  `[{ id, loanId, paymentInflowId, source, period {ym, label}, customer {id, name, externalId}, amount, principal,
  interest, penalty, deductionId, createdAt }]` + `meta`.
- `GET /admin/repayments/:id` adds `unapplied`, `repayment {…, principal, interest, penalty}|null`, `deduction {period,
  expected, paid, status}|null`, `loan`, `history [{action, note, actorId, actorName, createdAt}]`.
- **New** `GET /admin/repayments/:id/proof` → `{ url, expiresIn: 300 }`.
- `GET /admin/repayments/overview?from&to` (default this month) → `{ from, to, expected, collected, overdue, underpaid
  {amount, count}, failed {amount, count}, currentPeriod, expectingThisPeriod }`.
- `POST /admin/repayments/close-period` (SUPER_ADMIN) `{ period: 'YYYY-MM' }` (was "APRIL 2025") → 200 `{ periodId,
  label, closed, settled, failed, partial, penalties, penaltyTotal, proposals, errors }`.
- `PATCH /admin/repayments/:id/manual-resolution` `{ action: APPLY|SETTLE|REJECT, customerId?, note? }` (replaces
  `resolutionNote/userId/loanId`): APPLY assigns an unmatched/reviewing payment to a customer's running loan; SETTLE
  closes an overpayment (refund noted); REJECT drops a payment with nothing applied.
- `PATCH :id/accept-liquidation`, `:id/reject-liquidation` `{ note? }` (SUPER_ADMIN) → `{ id, customerId, state,
  amount, applied|null, outstanding|null }`.
- **Removed** `POST /admin/repayments/variation`.

### Payroll variations (`/admin/payroll-variations`)
- `GET ?period&action&reason` → `{ period {id, label, ym, submittedAt, closedAt, hasFile}, rows [{ loanId, customerId,
  externalId, name, command, balance, amount, tenure, action, reasons, start, end }], counts {START, AMEND, STOP} }`.
- `POST /generate` `{ period, email? }` → 202; the draft workbook is emailed. `POST /submit` `{ period }` (SUPER_ADMIN)
  → `{ periodId, period, counts, frozen, opened }`. `GET /file?period` → `{ url, expiresIn: 600 }` (404 before
  submission).
- **Removed** `initialize, preview, backfill, :id/email, :id/discard, :id/sent`.

### Dashboard (`/admin/dashboard/*`; `from/to` are YYYY-MM, were dates)
- `GET /admin/dashboard` → `{ activeCount, pendingCount, totalLoanAmount, totalDisbursed, managementFee, interestBooked,
  interestCollected, penaltyCharged, penaltyCollected, grossProfit, outstanding }` (renamed `totalMgtFee,
  interestEarned, interestReceived, penaltyReceived`; `outstanding` new and always all-time).
- `GET loan-report-overview` → `{ totalLoanAmount, totalDisbursed, outstanding, totalRepaid, interestBooked,
  interestCollected, activeLoansCount, pendingLoansCount }`.
- `GET disbursement-chart?from&to` (`year` removed) → `[{ period, categories {<category>: amount}, total }]` (was an
  object keyed Jan…Dec); at most 60 months.
- `GET open-loan-requests` → `{ cashLoans, topups (new), commodityLoans }`; asset loans moved out of `cashLoans`.
- `GET status-distribution` → every status, 0 when none. `GET customers-overview` unchanged.
- `GET operations` → `{ lastRepaymentRun|null, currentPeriod, rates {interestRate, managementFeeRate, penaltyRate,
  maxDeductionRate} (percent, null until set; were fractions, `penaltyFeeRate` renamed), attention
  {manualResolutions, pendingLiquidations, flaggedCustomers, pendingTenureChanges}, recentLoans, recentCustomers }`.

### Exports (`/admin/exports/*`, ADMIN and SUPER_ADMIN; MARKETER removed)
- `customers | cash-loans | commodity-loans | repayments` take their list's filters plus `email?` → `{ data: null,
  message }`; the file arrives as a link (no longer an attachment, and no longer 400 without an email). The repayments
  export lists payments received.

## Stage 6 — tenure changes, liquidation with proof, statements and reports
Uploads go direct to the API (multipart); everything else as before.

### Tenure changes (ADMIN, SUPER_ADMIN)
Replace v1's `/admin/repayment-obligations/*`. A change is proposed by the system (a missed or short deduction pushed
the loan over the net-pay cap), by an admin, or with a top-up; at most one is pending per loan.
- `GET /admin/tenure-changes?status&page&limit` → `[{ id, loanId, customer {id, name}, reason (DEFAULT|TOPUP|
  LIQUIDATION|ADMIN), status, monthsDelta, previousTenure, loanTenure, requestedBy {id, name}|null (null = the
  system), topupId, createdAt, decidedAt, note, netPay, cap, currentMonthly, proposedMonthly }]`. The last four are set on
  PENDING changes only: what approving would do (`cap` = net pay × the max deduction rate; null without payroll data or
  a cap).
- `POST /admin/tenure-changes/:id/approve` → 200, the item: the loan's tenure moves and the monthly deduction is
  re-spread. `POST /admin/tenure-changes/:id/reject` `{ note? }` → 200. Deciding twice → 409 "Already decided by another
  admin". A top-up's change is decided with its top-up.
- `POST /admin/customer/:id/tenure-changes` `{ monthsDelta (±1…120, not 0), apply? }` → 201, the item (`apply: true`
  approves it in the same call). 409 "This loan already has a pending tenure change"; 409 when the customer has no
  running loan.
- Admins are notified in-app of a proposal, and of an approval that lengthened a loan; the customer of an approval.

### Liquidation (paying off some or all of a loan outside payroll)
Proof: a PDF, JPG or PNG, at most 5 MB; the type is read from the file's content (a renamed file is 400). Proof links
are signed and last 5 minutes.
- `GET /user/loan/liquidation-preview` → `{ loanId, owed, repaid, outstanding, penaltyOutstanding,
  interestOutstanding, principalOutstanding, remainingMonths, monthly|null, endPeriod|null }` ("MARCH 2027": the last
  deduction month at the current pace). 409 "There is no active loan to liquidate".
- `POST /user/repayments/liquidation` (CUSTOMER, multipart `amount`, `proof`) → 201 `{ id, amount, state: AWAITING,
  requestedAt }`. 400 "Attach proof of payment (a PDF, JPG or PNG)", "Proof of payment must be a PDF, JPG or PNG file";
  413 over 5 MB; 409 "That is more than the ₦136,000.00 still owed" or no running loan. Super admins are notified.
- `GET /user/repayments/liquidations?state&page&limit` → `[{ id, amount, state, requestedAt, decidedAt|null,
  note|null (a rejection's reason), hasProof }]`.
- `GET /user/repayments/liquidations/:id/proof` → `{ url, expiresIn: 300 }` (only the customer's own).
- Admin, on the customer page: `GET /admin/customer/:id/liquidation-preview` (same shape), `POST
  /admin/customer/:id/request-liquidation` (ADMIN, SUPER_ADMIN; multipart `amount`, `proof`; same answers as the
  customer's), `GET /admin/customer/:id/liquidation-requests` (now also `decidedAt`, `note`), `GET
  /admin/customer/:id/liquidation-requests/:requestId/proof`. Deciding is unchanged: `PATCH
  /admin/repayments/:id/accept-liquidation | reject-liquidation` (SUPER_ADMIN); approval applies the amount at once and
  the statement shows it as "Liquidation".

### Statements and reports
A statement is the ledger lines (disbursements, interest, penalties, repayments) with a running balance; a report is a
summary of the customer's loans plus the statement. Ranges are payroll months `from`/`to` (YYYY-MM), defaulting to the
first disbursement month … this month. The customer's copy never shows management fees, the payment split, private
commodity details or internal notes.
- `GET /user/statement?from&to&page&limit` (CUSTOMER) → `{ from, to (labels), opening, debits, credits, closing, lines
  [{ date, loanId, reference, type, description, debit, credit, balance }] }` + `meta` (totals cover the whole range;
  `lines` is paged). The admin's is `GET /admin/customer/:id/loan-statement` (lines add `managementFee`, `split`).
- Files: `POST /user/statement`, `POST /user/report` (CUSTOMER), `POST /admin/customer/:id/statement`, `POST
  /admin/customer/:id/report`, body `{ from?, to?, format?: pdf|xlsx (pdf), email? }`, admin also `audience?:
  admin|customer` (admin) → **202** `{ jobId }`. The file arrives as an in-app notification with a 7-day download link,
  and by email at `email` or the requester's own address (none for phone-only customers). 400 "There is no disbursed
  loan to report on yet".
- **Removed** `POST /admin/customer/:id/generate-report` → `POST /admin/customer/:id/report`.
- `GET /admin/customer/:id/report-preview?audience&from&to` → the report as JSON: `{ audience, generatedAt, range
  {from, to, fromLabel, toLabel}, customer {id, name, externalId, phoneNumber, email, organization, command, status},
  loans [loan figures + id, status, category, disbursementDate, commodity {name, details}|null, topups], statement
  {opening, debits, credits, closing, lines}, totals {repaid, outstanding, repaymentRate} }`; the admin copy adds
  `revenue {interestBooked, interestCollected, managementFee, penaltyCharged, penaltyCollected}` (for the range),
  `accountOfficer`, `notes {flagReason, history [{action, note, actorName, createdAt}]}` and
  `commodity.privateDetails` (absent, not null, in the customer copy).

## Stage 7 — hardening (no route changes)
- No routes or response shapes changed. The whole v2 API is the sum of the Stage 1–6 sections above; Swagger at
  `/docs` is the reference for every field.
- `scripts/smoke-v2.ts` exercises the main flows end to end over HTTP and is a working example of the call sequence:
  sign-in with 2FA, loan → payroll month → liquidation → statement.

## Post-v2 additions
- `POST /admin/customer/:id/statement` and `POST /admin/customer/:id/report` take `protect?: boolean` (default false):
  the PDF (AES-256) or XLSX (Office encryption) only opens with the customer ID as the password (e.g. `MB-HOWP2`).
  The in-app/email message says so. The customer's own `POST /user/statement|report` is unchanged.
- `PATCH /admin/customer/:id/account-officer` (SUPER_ADMIN) body `{ accountOfficerId }`: an admin's user id, or
  `microbuilt-system-id` to hand the customer back to the platform → `{ data: null, message }`. 404 "Account officer
  not found" for an unknown or SYSTEM admin. Audited as `CUSTOMER_OFFICER_CHANGED` (new `AuditAction`, migration
  `20261005120000_customer_officer_audit`) with the note "from → to".
- **Change requests** (migration `20261005160000_change_requests`). Changes to someone's details no longer apply at
  once: they become a `ChangeRequest` (`kind` IDENTITY | PAYMENT_METHOD | PROFILE, `status` PENDING | APPROVED |
  REJECTED | CANCELLED, `proposed` = only the changed fields, `previous` = their values when asked) that an admin
  approves. One pending request per user and kind; a later edit folds into it. A super admin's own profile changes
  still apply at once. First-time `POST /user/identity` and `POST /user/payment-method` are unchanged.
  - `PATCH /user/identity` and `PATCH /user/payment-method` → **202** `{ data: ChangeRequest | null, message }`
    (null: nothing differs from the live details). Same validation as before (name match, account number/BVN
    taken → 409); the account is no longer FLAGGED by an update.
  - Email, phone and name changes through better-auth (`/email-otp/change-email`, `/phone-number/verify` with
    `updatePhoneNumber`, `/update-user`) still verify the code and answer success, but the user row keeps its
    values: a PROFILE request is created instead. Read `GET /user/change-requests` after success to show "waiting
    for approval". (The email-change session cookie can show the new address for up to 5 minutes; `GET /user` is
    always right.) A photo (`POST /user/avatar`) is not a change request: it changes at once, as before.
  - `GET /user/change-requests?status&page&limit` (own requests) and `DELETE /user/change-requests/:id` (withdraw a
    pending one; 409 once decided).
  - `GET /admin/change-requests?status&kind&userId&page&limit` (ADMIN, SUPER_ADMIN). Admins see customers'
    requests; super admins also see admins'. Each item has `canDecide`.
  - `POST /admin/change-requests/:id/approve` and `POST /admin/change-requests/:id/reject` `{ note? }` →
    `ChangeRequest`. 409 "Already decided by another admin"; 409 when an account number, BVN, email or phone was
    taken by someone else meanwhile; 403 for your own request, or an admin's request decided by anyone but a super
    admin. Audited as `CHANGE_REQUEST_APPROVED` / `CHANGE_REQUEST_REJECTED` (entity `CHANGE_REQUEST`). Admins are
    notified in-app of new requests (`/admin/change-requests`); the user is notified of the decision.
- **Audit page** (migration `20261005170000_audit_page`). `GET /admin/audit` (SUPER_ADMIN)
  `?actorId&action&entityType&entityId&from&to&page&limit` (`from`/`to` are Lagos days, `YYYY-MM-DD`, inclusive) →
  paginated `{ id, action, entityType, entityId, entityLabel, note, meta, actor: { id, name, role }, createdAt }`,
  newest first. `entityLabel` names the person for USER and LOAN entries; `meta` is structured detail (a settings
  change's `{ before, after }`, an export's filters, a document request's kind/format). `AuditLog` gains `meta`.
  New actions: `SETTINGS_UPDATED`, `MAINTENANCE_TOGGLED` (entity `SETTINGS`), `COMMODITY_ADDED`,
  `COMMODITY_UPDATED` (entity `COMMODITY`), `CUSTOMER_ONBOARDED` (USER), `CUSTOMERS_IMPORTED`, `DATA_EXPORTED`
  (entity `FILE`: the sheet's name or the dataset), `DOCUMENT_GENERATED` (USER: an admin's statement/report request).
  Customers' own exports and statements aren't audited.
- **Statements and reports redesigned, customer copies always protected.** The PDF reads like a bank statement:
  logo and title, the customer block (name, address, customer ID, IPPIS number, employer, contacts) beside the
  statement block (period, reference `ST-<id>-<yyyyMMddHHmm>`, loans), the balance sum (opening + debits − credits =
  closing), monthly deduction and months left, then the transactions with a column header repeated on every page and
  the reference on every footer. The XLSX has the same blocks. Files are named like a bank's:
  `NAME_MB-XXXXX_yyyyMMddHHmmss_statement.pdf`.
  - A **customer copy** (`POST /user/statement|report`, or an admin's `audience: "customer"`) is now always
    password-protected with the customer ID; `protect` only matters for an admin's internal copy (default off). The
    message says how to open the file but never contains the ID.
  - `CustomerReportDto.customer` (report preview) gains `address` (string | null).
- **Customers can no longer write payroll details**: `POST /user/payroll` and `PATCH /user/payroll` are removed
  (404). Payroll details only come from payroll (the upload, onboarding, the existing-customer import); `GET
  /user/payroll` is unchanged.
- Admin notifications about tenure changes now open `/loans/tenure-changes`; change requests open `/approvals`.
- `GET /admin/repayments/deductions/:deductionId` → the deductions-list row plus `createdAt`, `payments [{ id
  (repayment), paymentInflowId, source, amount, principal, interest, penalty, createdAt }]` (oldest first) and
  `calculation` (OPEN only, else null): `{ owed, repaid, outstanding, committed, toSpread, tenure, monthsSent,
  remainingMonths, amount, stopped }`, where `amount = toSpread ÷ remainingMonths` (the whole of it in the last month)
  and `toSpread = outstanding − committed`. 404 "Deduction not found".
- `PaymentInflowSource` gains `IMPORT` (migration `20261005180000_import_inflow_source`): what an imported running loan
  had already repaid before it came over (the sheet's "amount paid"), booked as one settled inflow in the period of
  the import. It used to be a PAYROLL inflow with no upload, which read like a payroll month. Existing ones were
  converted. Filters (`?source=IMPORT`) and every `source` field can carry it; the statement calls the line
  "Repaid before import".
- **Admin notifications clear themselves** (migration `20261006090000_notification_subject`: `Notification.subject`).
  Prompts about one thing carry a subject (`liquidation:<inflowId>`, `change-request:<id>`, `tenure-change:<id>`)
  and are deleted for every admin once it is decided or withdrawn.
- The liquidation-request notification now opens `/repayments?tab=inflows&inflow=<inflowId>` (it pointed at a
  non-existent `/admin/customers/:id`); the Repayments page reads `tab` and `inflow` and opens that inflow.
- Loan approvals need the borrower's identity details and payroll data on file: `PATCH /admin/loans/cash/:id/approve`
  and approving an asset request that opens a loan answer 409 "Add the customer's identity details and payroll data
  before approving this loan" (naming what is missing). Onboarding's first loan is exempt.
- `POST /admin/customer/:id/payroll` (ADMIN, SUPER_ADMIN) `{ externalId, organization, command, grade?, step? }` adds
  payroll data for a customer who has none → `{ data: null, message }`. 409 when payroll is already on file (it then
  changes only through payroll uploads) or the IPPIS number belongs to another customer.
- **Every notification links somewhere useful.** Admin prompts deep-link to the item: change requests
  `/approvals?request=<id>`, tenure changes `/loans/tenure-changes?change=<id>`, liquidations
  `/repayments?tab=inflows&inflow=<id>`, payroll upload results `/repayments?tab=inflows&upload=<uploadId>`, the
  variation reminder `/dashboard?variation=open` (was a non-existent `/admin/payroll-variations`). Customer
  notifications (which had no link) open `/dashboard` (disbursed, tenure updated, fully repaid), `/loan-request`
  (top-ups) or `/repayments` (penalty, repayment received, liquidation decided).

- **Inflow routes move under `/admin/repayments/inflows`** (`/admin/repayments` served inflows, which read like
  repayments): `GET /admin/repayments/inflows`, `GET …/inflows/:id`, `GET …/inflows/:id/proof`,
  `PATCH …/inflows/:id/manual-resolution`, `PATCH …/inflows/:id/accept-liquidation`, `PATCH …/inflows/:id/reject-liquidation`.
  Bodies and responses are unchanged; the old paths are gone. Deductions (`/deductions`) and applied repayments
  (`/applied`) stay where they were.
- `GET /admin/repayments/overview` adds money-in figures next to the deduction ones: `received { amount, count,
  bySource { PAYROLL, LIQUIDATION, IMPORT } }` (inflows for the months, rejected excluded), `applied { amount, count,
  principal, interest, penalty }` (repayments made from them) and `unresolved { amount, count }` (inflows of any month
  still UNMATCHED, AWAITING or REVIEWING). `collected` and `overdue` still count deductions only.
- An OPEN deduction keeps the amount payroll was last sent when the new monthly split differs from it by one kobo of
  rounding, so a variation no longer lists 1-kobo AMEND rows. The last month still takes the exact remainder.
- `POST /admin/payroll-variations/revert` (SUPER_ADMIN) `{ period: "YYYY-MM", reason, code }` (`code`: the super
  admin's current authenticator code; 5 wrong codes lock it for 15 minutes) undoes a submission
  made by mistake: the month goes back to unsubmitted, its deductions back to OPEN (recomputed), the next month's OPEN
  deductions the submit opened are deleted (a loan disbursed after the submit moves its first deduction back to the
  month) and the stored file is removed → `{ periodId, period, reopened, removed }`. 403 "That code is not
  correct. Use the current one from your app"; 409 when the month isn't submitted, is closed, a later month is submitted, a payroll file was uploaded for
  it or payments were applied to its deductions. Audit log: `VARIATION_REVERTED` (migration
  `20261006180000_variation_reverted`) with the reason. The preview's `period.revertBlockedBy` is the 409 message, or
  null when the month can be reverted (always null before it is submitted).
- Imported loans (customer import) take TENOR as the months left, as written, and open their first deduction in START
  DATE's month (or the next month whose variation hasn't gone out; never before last month). It used to recount the
  months from the first unsent payroll month to END DATE, squeezing the balance into fewer months.
- Submitting a variation is called **generating** it in the UI and messages ("The JUNE 2026 variation has been
  generated"); the route stays `POST /admin/payroll-variations/submit`. Generating and reverting both notify every
  super admin in-app (opening `/dashboard?variation=open`) and by email: a generated variation's email carries the
  file and who generated it, a revert's says who reverted it and why.
- `POST /admin/payroll-variations/generate` no longer takes `email`: the draft always goes to the signed-in admin's own
  address. 400 "Add an email address to your account to receive drafts" when they have none (phone-only accounts).
- `GET /admin/customer/:id/summary` adds `monthlyDeduction` (the running loan's OPEN deduction, null without one),
  `monthsLeft`, `nextDeductionPeriod` ("NOVEMBER 2026") and `openRequests { loans, topups, assets, total }` (loan
  requests and top-ups PENDING or APPROVED, asset top-ups IN_REVIEW). `activeLoansCount` and `pendingLoansCount` stay
  for compatibility.
- `GET /admin/loans/topups/:id` (ADMIN, SUPER_ADMIN) → one top-up, the same shape as the list's rows; 404 "Top-up not
  found". The customer page's Loan Applications card opens it instead of the whole loan.
- `GET /user/repayments/deductions?page&limit` → the customer's deductions, latest month first:
  `{ id, loanId, period, expected, paid, outstanding, status, settledAt }` (OPEN: not sent to payroll yet).
- `GET /user/repayments/inflows?page&limit&source` → money received for the customer, newest first:
  `{ id, source, state, amount, applied, period, receivedAt }`. No staff IDs, uploads or admin fields on either.
- `GET /admin/customer/:id/summary` drops `activeLoansCount` and `pendingLoansCount` (nothing reads them; see
  `openRequests`). The loans report overview keeps its own counts.
- `GET /admin/payroll-variations/open` → `{ ym, label }`: the month the next variation is for (the earliest holding
  OPEN deductions; with none, the first month from now not yet generated). The variation dialog opens on it.
- **Admins propose customers' payroll, identity and bank details** (ADMIN, SUPER_ADMIN; 202, `data` the
  ChangeRequestDto or null when nothing differs): `PATCH /admin/customer/:id/identity` (UpdateIdentityDto),
  `PATCH /admin/customer/:id/payment-method` (UpdatePaymentMethodDto) and `POST /admin/customer/:id/payroll`
  (was a direct write; now only proposes, still only while the customer has no payroll). With no record on file every
  required field is needed (400 names the missing ones); approving creates the record. 409 when an account number,
  BVN or IPPIS is another customer's, or the customer's own request of that kind is waiting. Audit:
  `CHANGE_REQUEST_PROPOSED`.
- Change requests carry `requestedBy { id, name } | null` (the proposing admin) and a new kind `PAYROLL`. An admin's
  proposal is decided only by a super admin (403 for admins; the proposing super admin may decide it), only super admins are prompted,
  the customer is told when it's proposed and decided, and can withdraw it (the proposer is told). Migration
  `20261007090000_admin_change_requests`.
- `DELETE /admin/commodities/:id` (SUPER_ADMIN) deletes a commodity no asset request uses → the deleted row; 409
  "<Name> has asset requests, so it can't be deleted. Hide it from customers instead." otherwise. `GET
  /admin/commodities` adds `inUse` per row. Audit: `COMMODITY_DELETED` (migration `20261007100000_commodity_deleted`).
- `GET /admin/dashboard/operations` adds `awaitingPayrollPeriod` (the earliest generated month whose deductions wait
  on the payroll file; null when none) and `nextVariationPeriod` (the month holding the OPEN deductions).
  `lastRepaymentRun.upToDate` now means no generated month is waiting on its file (it was "uploaded this calendar
  month"). The Payroll run card follows these instead of the calendar.
- A customer can withdraw a change an admin proposed for them (`DELETE /user/change-requests/:id`); the proposing admin
  is told in-app. A super admin may approve or reject a change they proposed themselves.
- `POST` / `PATCH /user/payment-method` no longer require the account name to match the customer's name (the 422
  "Provided account name does not sufficiently match the account name." is gone).
- **Confirmations for core admin actions.** Routes marked `@Confirm` answer 403
  `{ code: "CONFIRMATION_REQUIRED", mode, methods: { totp, passkey }, message }` until the user re-proves it's them:
  - `POST /confirmations/code { code }` (authenticator) or `POST /confirmations/passkey/options` → `{ id, options }`
    (WebAuthn request options, user verification required) then `POST /confirmations/passkey { id, response }`. Both
    → `{ token, expiresAt }` (5 minutes). `GET /confirmations/methods` → `{ totp, passkey }`.
  - `action` routes spend one token each, sent as the `X-Confirmation` header (or `?confirmation=` on direct uploads):
    `PATCH /admin/loans/cash/:id/disburse`, `PATCH /admin/loans/topups/:id/disburse`, `POST /admin/repayments/upload`,
    `POST /admin/payroll-variations/submit`, `POST /admin/payroll-variations/revert`, `POST /admin/repayments/close-period`,
    `PATCH /admin/repayments/inflows/:id/accept-liquidation`, `POST /admin/customers/upload-existing`,
    `POST /admin/change-requests/:id/approve` (bank-details changes only) and `POST /admin/users/:id/reset-sign-in`.
  - `window` routes pass for ten minutes after any confirmation of the same session: `PATCH /admin/rate`,
    `PATCH /admin/maintenance`, `POST /admin/invite-admin`, `PATCH /admin/remove-admin`, `PATCH /admin/admins/:id/role`
    and `POST /admin/customers` (adding a customer).
  - 403 `CONFIRMATION_SETUP_REQUIRED` when the user has neither 2FA nor a passkey.
  - `POST /admin/payroll-variations/revert` no longer takes `code` (the confirmation replaces it).
- **Who must have 2FA:** only super admins, and a passkey counts (403 `TWO_FACTOR_SETUP_REQUIRED` until they have
  either). Admins and marketers no longer have to set it up. Admins may register passkeys and sign in with them; magic
  links and email/SMS codes stay customer-only ("Admins sign in with a password or a passkey"). A super admin with a
  passkey but no 2FA can't sign in with the password alone, and can't remove their last factor (2FA off without a
  passkey, or the last passkey without 2FA).
- `GET /user` adds `hasPasskey`. `GET /admin` (admin list) adds `twoFactorEnabled` and `passkeys` (count).
- `PATCH /admin/admins/:id/role { role }` (SUPER_ADMIN): not your own, not SYSTEM, never the last active super admin
  (409). Audit `ADMIN_ROLE_CHANGED` (meta `{ from, to }`); the admin is told in-app.
- `POST /admin/users/:id/reset-sign-in { reason }` (SUPER_ADMIN): for a locked-out customer or admin, removes their
  2FA and passkeys and signs them out everywhere. Not your own or SYSTEM's. Audit `SIGN_IN_RESET` (note: the reason;
  meta `{ twoFactorRemoved, passkeysRemoved }`); the user is told in-app and by email or SMS.
- **BVN to super admins only:** `GET /admin/customer/:id/ppi-info` leaves `paymentMethod.bvn` out for everyone else,
  and change requests show a BVN as `•••••••••••` to anyone but a super admin (customers included).
- Migration `20261008090000_confirmations` (`Confirmation` table, `ConfirmationMethod`, audit actions
  `ADMIN_ROLE_CHANGED` and `SIGN_IN_RESET`).
- **Magic links and email/SMS sign-in codes are open to admins and marketers;** only super admins are refused (403
  "Super admins sign in with a passkey, or a password and 2FA"), since those sign-ins skip the second factor. Super
  admins sign in with a passkey or password + 2FA.
- **Disbursing is a `window` confirmation now:** `PATCH /admin/loans/cash/:id/disburse` and
  `PATCH /admin/loans/topups/:id/disburse` pass for ten minutes after a confirmation, like settings.
- **Repricing a tenure change.** `POST /admin/customer/:id/tenure-changes` takes `reprice` (default false; lengthening
  only, 400 otherwise). When the change is applied it also books interest for the added months: the principal still
  owed (after payments received and the deductions already sent to payroll, split by the ratio method) × the
  loan's monthly rate × months added, as an INTEREST microloan. Off: the tenure moves and what is owed stays.
  `TenureChangeItemDto` adds `reprice` and `interestAdded` (applied: what was booked; pending: what it would book
  now; `proposedMonthly` includes it). Migration `20261009090000_tenure_change_reprice`.
- **Top-up approval can edit its tenure change.** `PATCH /admin/loans/topups/:id/approve` takes
  `{ monthsDelta?: number | null, reprice?: boolean }`: monthsDelta replaces the change requested with the top-up
  (0 or null drops it; absent keeps it), reprice (months added only) also books interest on the running loan for
  the added months when the top-up is disbursed. `PATCH /admin/loans/commodity/:id/approve` (asset top-up) takes
  `reprice` alongside `monthsDelta`. Top-up `tenureChange` adds `reprice`.
- `GET /user/loan/micro` (paginated, `status` MicroLoanStatus): the customer's micro-loans that are money lent, each
  loan's first payout (`purpose` NEW_LOAN) and its top-ups (TOPUP), with amount, status, dates, `assetName`,
  `loanCategory` and `tenureChange`.
- `GET /user/notifications/stream` (any signed-in user; SSE, `text/event-stream`, **direct** to the API with
  `new EventSource(url, { withCredentials: true })`): a `notifications` event (`{"changed":true}`) whenever the
  user's notifications change — a new one, one read on another tab or device, or an admin prompt cleared — then
  refetch `GET /user/notifications`; a `ping` every 25 s. Signals go through Redis pub/sub, so any API instance or
  worker that writes a notification reaches every open stream.
- `GET /user/loan/micro/:microLoanId` → one of the customer's micro-loans (a top-up or a loan's payout), the same
  shape as `GET /user/loan/micro` rows; 404 "This top-up or payout could not be found". Top-up notifications link to
  it: `/loan-request?microLoan=<id>` opens the Micro-loans tab with its details.
- Asset top-up notifications and recent activity name the asset, then its price ("Your top-up request for the Solar
  Inverter (₦250,000) has been approved…"), instead of reading like a cash top-up.
- `GET /user/loan/commodity` rows gain `stage` (`IN_REVIEW | APPROVED | DELIVERED | REJECTED`: past review, whether
  the top-up or the loan it opened was paid out or rejected) and `microLoanId` (its top-up, once approved). `status`
  stays the request's own review status, which stays APPROVED after delivery.
- `PATCH /admin/repayments/inflows/:id/reject-liquidation`: `note` is now **required** (400 "Say why the liquidation
  is rejected" when missing or blank). The admin UI asks for it in a second, confirming dialog.
- `GET /user/loan/overview` gains `runningLoanRates { interestRate, managementFeeRate } | null` (percent): the
  disbursed loan's own rates, which a top-up is charged (not today's Settings). The top-up request forms show these.
- `PATCH /admin/loans/topups/:id/disburse` takes an optional body `{ monthsDelta?, reprice? }` (as approve): the
  approved tenure change can still be changed, added or dropped (0) as the top-up is disbursed; an empty body applies it
  as approved. `GET /admin/loans/topups/:id` gains `rejectionNote` (a REJECTED top-up's reason, from the audit log).
- A top-up's tenure change only adds months: `ApproveTopupDto.monthsDelta` ≥ 0 and the asset top-up approval's
  `monthsDelta` ≥ 1 (400 otherwise). Top-up rows' `tenureChange` gains `interestAdded`.
- `POST /admin/payroll-variations/submit` refuses a month that hasn't ended (Lagos time): 409 "OCTOBER 2026 hasn't
  ended yet: its variation can be generated from 1 NOVEMBER 2026". Preview and the emailed draft still work for any
  month. The "Submit the … variation" reminder now runs at 09:00 Lagos on the 1st, for months already over.
- `POST /admin/customer/:id/loan-topup` takes `kind: CASH | ASSET` instead of a loan category (the top-up keeps the
  running loan's; `category` is still accepted from older clients). `monthsDelta` (cash only) must be ≥ 1.

## Per-organization variations and vouchers (PLAN_V2, migration `20261010090000_organization_variations`)
Variations are generated per organization, as often as needed in a month, until that organization's voucher (its
repayment file) locks the month. Close period is gone: the voucher, or a "No payroll", settles the month. Contract:
`docs/PLAN_V2.md` §2; rules R1–R8 there. `OrgRef = { id, name }`, `Month = { ym, label }`.

- **Removed:** `/admin/payroll-variations/*`, `POST /admin/repayments/upload`, `POST /admin/repayments/validate`,
  `POST /admin/repayments/close-period`, `GET /admin/customers/organizations`. The audit actions
  `VARIATION_SUBMITTED`, `VARIATION_REVERTED`, `PERIOD_CLOSED` and `PAYROLL_UPLOADED` and the entity types
  `PAYROLL_PERIOD`/`PAYROLL_UPLOAD` are gone.
- **New audit values:** actions `VARIATION_GENERATED`, `VOUCHER_UPLOADED`, `VOUCHER_REVERTED`, `NO_PAYROLL`,
  `NO_PAYROLL_REVERTED`, `ORGANIZATIONS_MERGED`; entity types `VARIATION`, `VOUCHER`, `ORGANIZATION`.
- **Variations** (`/admin/variations`, ADMIN and SUPER_ADMIN unless noted). `VariationState = { id, version, createdAt,
  updatedAt, lock: { kind: 'VOUCHER', voucherId, filename, uploadedAt } | { kind: 'NO_PAYROLL', reason } | null,
  regenerateHint, versions: number[] }`.
  - `GET ?organizationId&period=YYYY-MM&action?&reason?` → `{ organization, period, variation: VariationState | null,
    rows (filtered, today's row shape), counts {START, AMEND, STOP} (unfiltered), frozen, skipped, generateBlockedBy }`.
    Once locked, `rows` are what the current version holds.
  - `GET history?organizationId` → `[{ id, period, version, updatedAt, lock }]`, newest month first.
  - `POST generate` (SUPER_ADMIN, `@Confirm('action')`) `{ period, organizationIds? | all: true }` → `{ period, queued,
    skipped, refused [{ id, name, reason }] }`. One background job per queued organization; the requester gets an
    in-app notification when each finishes or fails.
  - `POST draft` `{ period, organizationId }` → `{ period (label), organization (name), email }`: emails the xlsx
    generating would produce now; nothing is frozen.
  - `GET :id/file?version` (default current) → `{ url, expiresIn, filename }`. Older versions are kept until the
    variation locks.
  - `POST :id/no-payroll` (SUPER_ADMIN, `@Confirm('action')`) `{ reason }` → `{ variationId, label, failed, penalties,
    penaltyTotal, proposals }`. 409 before the month ends, when locked, or while an earlier month of the organization
    is unlocked.
  - `DELETE :id/no-payroll` (SUPER_ADMIN, `@Confirm('action')`) `{ reason }` → `{ variationId, penaltiesRemoved,
    proposalsWithdrawn }`. 409 once the next month is locked, or a payment has been applied since.
- **Vouchers** (`/admin/vouchers`, SUPER_ADMIN, direct upload) replace the payroll upload:
  - `POST` (`@Confirm('action')`) multipart `{ file, organizationId, period? }` → `{ voucherId, variationId,
    organization, period (label), rows }`; processed in the background. 409 with no variation for the month, when it is
    locked, for a file already uploaded, and `{ statusCode: 409, message, earlierUnlocked: [{ variationId, ym, label }] }`
    while an earlier month of the organization has no voucher (offer No payroll for those, then retry). The sheet's
    organization column is no longer required or read.
  - `POST validate` (same multipart) → today's sheet report plus `{ organization, variation: { id, version } | null,
    issues: { unmatched, otherOrganization, notInVariation }, earlierUnlocked, conflicts }`.
  - `DELETE :id` (`@Confirm('action')`) `{ reason }` → `{ variationId, inflowsRemoved, penaltiesRemoved,
    proposalsWithdrawn }`. Only while the month is the current Lagos month and the organization has no variation for
    the next one; also refused after a later payment (a liquidation) on its loans.
- **Repayments:** inflows' `uploadId` → `voucherId` (list, detail, export; filter `?voucherId`). `PATCH
  /admin/repayments/inflows/:id/manual-resolution` adds `{ penaltyCleared, fallbackReason }`: an APPLY on a row the
  voucher couldn't match clears the penalty its settling charged, unless a payment has collected part of it since or
  its tenure change was decided (`fallbackReason` says which).
- **Organizations** (`/admin/organizations`, ADMIN and SUPER_ADMIN):
  - `GET` → A–Z `[{ id, name, customers, runningLoans, latestLocked: Month | null, unlocked [{ variationId, ym, label,
    version, updatedAt, regenerateHint }], deductionsThisMonth }]`.
  - `POST :id/merge` (SUPER_ADMIN, `@Confirm('action')`) `{ intoId }` → `{ intoId, movedPayrolls }`: payrolls,
    variations and pending switch requests move across. 409 when both have a variation for the same month, when a
    month waiting for its voucher would sit behind a locked one, or when loans' open deductions would land in a month
    the merged organization has already generated.
  - `POST :id/switch-requests` `{ externalIds: string[] }` → `{ results [{ externalId, outcome: CREATED | NOT_FOUND |
    ALREADY_IN_ORGANIZATION | PENDING_EXISTS, requestId? }] }`.
- **Change requests:** new kind `ORGANIZATION` (`proposed { organizationId, organization }`). Any admin proposes one;
  only a SUPER_ADMIN approves or rejects it (403 otherwise). Approving moves the payroll record; a loan's open
  deduction moves past any month the new organization has already generated.
- **Customers:** `GET /admin/customers` filters by `organizationId` (was `organization`, a name). Payroll details in
  every response (`/admin/customer/:id`, `/user/payroll`, exports, reports) keep `organization` (the name) and add
  `organizationId`. Onboarding, the import and the PAYROLL change request still take an organization name: an existing
  one is reused, any other creates an organization.
- **Dashboard:** `GET /admin/dashboard/operations` drops `awaitingPayrollPeriod` and `nextVariationPeriod` for
  `organizations [{ id, name, latestLocked, awaitingVoucher: Month[], toGenerate: Month | null }]`;
  `lastRepaymentRun` adds `organization`. Repayment rates and the customers overview's status counts read each
  organization's locked variations.
- Admin notifications: variation reminders go to SUPER_ADMIN per organization and open
  `/variations?organizationId=<id>&period=YYYY-MM`; voucher results open `/repayments?tab=inflows&voucher=<id>`.
- **Variation rows for borrowers who moved:** a loan whose borrower moved to another organization is listed as a
  STOP (amount 0, tenure 0, new reason `TRANSFER`) in the old organization's next variation, once. `reason=TRANSFER`
  filters them on `GET /admin/variations`.
- **Organizations page** (migration `20261011090000_organization_audit`; new audit actions `ORGANIZATION_CREATED`,
  `ORGANIZATION_RENAMED`, `ORGANIZATION_DELETED`):
  - `POST /admin/organizations` `{ name }` (ADMIN, SUPER_ADMIN) → the organization (list item shape). 409 "NPF already
    exists" when the name matches one, ignoring case and spaces.
  - `GET /admin/organizations/:id` → one list item; `GET /admin/organizations/:id/stats` → the account-officer stats
    shape (`customers { total, active, inactive, flagged, avgRepaymentScore }`, `portfolio { … }`) for its customers.
    Its customers: `GET /admin/customers?organizationId=`.
  - `PATCH /admin/organizations/:id` `{ name }` (SUPER_ADMIN, `@Confirm('window')`) renames it. 409 when another
    organization has the name ("merge into it instead"). Files already sent keep the old name.
  - `DELETE /admin/organizations/:id` (SUPER_ADMIN, `@Confirm('window')`) → `{ data: null }`. 409 while it has
    customers, variations or pending moves into it.
- **Organizations waiting for approval** (migration `20261012090000_organization_approval`; new audit action
  `ORGANIZATION_APPROVED`):
  - Organization list items (`GET /admin/organizations`, `:id`) add `status: 'ACTIVE' | 'PENDING'` and
    `requestedBy: string | null` (who named it, while PENDING).
  - A new name from a SUPER_ADMIN (organizations page, onboarding, import, or approving a PAYROLL change request) is
    ACTIVE. From an ADMIN or MARKETER it is PENDING: the customer joins it at once, super admins get a notification
    (opens `/organizations/<id>`), and generating its variation is refused ("… is waiting for a super admin to approve
    it") until it's approved or merged into the organization it misspelt. An existing name is reused whatever its status.
  - `POST /admin/organizations/:id/approve` (SUPER_ADMIN, `@Confirm('window')`) → the organization. 409 when it is
    already approved.
- **Onboarding by a marketer:** a first cash loan is created PENDING (tenure 0; the tenure asked for is in the
  onboarding audit note) for an admin to approve, no longer APPROVED. Admins' and super admins' are still approved at
  once. The response message says which.
- **Customer statements:** `POST /user/statement` and `POST /user/report` take `protect?: boolean` (default `true`):
  `false` sends the customer's own copy without a password. A customer copy an admin sends stays protected.
- **Variation generated:** every generation now notifies all super admins in-app (plus the requester, if not one),
  opening `/variations?organizationId=<id>&period=YYYY-MM`, and emails each super admin the generated file
  ("Generated Payroll Variation – <MONTH> (<org>) v<n>"). The admin app no longer offers "Email me a draft"
  (`POST /admin/variations/draft` stays).

## Marketer view
- **A marketer only reaches the customers they onboarded** (their account officer): every `/admin/customer/:id/...`
  route answers 404 "…not found" for anyone else's customer. Admins and super admins are unchanged.
- `GET /admin/account-officer/me/customers` (same filters as the customer list) and `GET /admin/account-officer/me/stats`
  (as `/:id/stats`): the signed-in admin's or marketer's own customers. `GET /admin/account-officer/me` stays.
- New `/marketer/*` (MARKETER only), each limited to the marketer's own customers (404 otherwise):
  - `GET /marketer/overview` → `{ waiting: WaitingItem[] }`, oldest first: customers awaiting activation (`CUSTOMER`),
    loans, asset requests and top-ups awaiting a decision or disbursement (`LOAN | ASSET_REQUEST | TOPUP`), and
    organizations they added that await approval (`ORGANIZATION`). Each has `title`, `detail`, `customer`, `since`,
    `escalation` (what to escalate it as, or null), `stage` (`DECISION | DISBURSEMENT`) and `lastEscalatedAt`.
  - `GET /marketer/loans`, `/marketer/asset-requests`, `/marketer/topups`: as the admin lists (same query), each row
    plus `stage` and `lastEscalatedAt`. `GET /marketer/loans/:id`, `/asset-requests/:id` (no `privateDetails`),
    `/topups/:id`: as the admin detail routes.
  - `GET /marketer/repayments/overview?period=YYYY-MM` → `{ period, expected, collected, counts }` (deductions by
    status; the period defaults to the latest month their customers had deductions). `GET /marketer/repayments/deductions`
    → as `/admin/repayments/deductions`.
  - `GET /marketer/admins` → `[{ id, name, role }]`, active admins and super admins.
  - `POST /marketer/escalations` `{ kind: LOAN | ASSET_REQUEST | TOPUP, id, adminId?, note? }` → `{ sentTo, skipped,
    escalatedAt }`: asks one admin, or everyone who can act on it now (any admin for a decision, super admins for a
    disbursement), in-app (opening the admin page for it) and by email. 400 when a single admin can't act at that stage
    (an ADMIN for a disbursement); 409 when it is already decided, or everyone asked was asked about it at this stage in
    the last 24 hours (those are skipped otherwise). Deciding or disbursing it clears the admins' escalation notifications.
