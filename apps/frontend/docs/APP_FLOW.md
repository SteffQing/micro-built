# MicroBuilt Frontend — App Flow

> A top-down walkthrough of the application from entry point to each feature.  
> **Stack:** Next.js 16 (App Router) · better-auth · React Query · Axios · Zod · Shadcn/UI · Tailwind CSS 4

---

## 1. Entry Points & Bootstrapping

### Root Layout (`src/app/layout.tsx`)
The root layout wraps the entire app in `RootProvider`, which chains:
1. **ReactQueryClientProvider** — TanStack Query with per-route stale times and global toast error handling
2. **ThemeProvider** — Light/dark mode via next-themes
3. **AuthProvider** — Runs `useUserProvider()` which fetches the current user and handles automatic redirects
4. **Sonner** — Global toast notification renderer

### Auth Guard (`src/store/auth.ts` — `useUserProvider`)
On every page load:
- `authClient.useSession()` (better-auth, httpOnly cookie session; nothing is stored in localStorage)
- `GET /user` for `role` and `twoFactorEnabled`
- Signed-in users on an auth page → `/dashboard`
- An admin without 2FA is sent to Settings → Security (`/settings/security?setup=2fa` redirects to `/settings?view=security`) and the API answers 403 `TWO_FACTOR_SETUP_REQUIRED` for everything else
- Exposes: `user`, `userRole`, `twoFactorEnabled`, `isUserLoading`, `logout`

`src/proxy.ts` does optimistic cookie-based redirects (UX hint only) and rewrites `/api/auth/*` to the API with the edge headers. `src/lib/axios.ts` has two clients: `api` (`/api`, same origin, rewritten to the API) and `uploads` (direct to `NEXT_PUBLIC_API_URL`, multipart and downloads). A `401` → `/login?next=`; a 403 `TWO_FACTOR_SETUP_REQUIRED` → Settings → Security (unless already in Settings).

---

## 2. Route Groups

```
app/
├── (auth)/          — Unauthenticated pages (login, sign-up, etc.)
│   └── layout.tsx   — Split layout: hero image on left, form on right
├── (marketing)/     — Public landing page (/)
└── (protected)/     — Authenticated pages
    └── layout.tsx   — Sidebar + header shell
```

---

## 3. Authentication Flow (`(auth)/`)

All calls use the better-auth client (`src/lib/auth-client.ts`, plugins from `@microbuilt/backend/auth-client`); mutations live in `src/lib/mutations/user/auth.ts`.

- **Sign up** (`/sign-up`): email and/or phone. Email → `signUp.email` → email code step; phone-only → placeholder email + SMS code (`phoneNumber.sendOtp` / `verify`).
- **Verify** (`/verify-code`): `emailOtp.verifyEmail`, resend via `emailOtp.sendVerificationOtp`.
- **Login** (`/login`): email + password by default, with a link on the Email label to switch to phone + password. Alternatives under "or": **Email me a code** and **Email me a magic link** (email form only), plus **Sign in with passkey**. Admins use password + 2FA only; passwordless attempts show "Admins sign in with password and 2FA".
- **2FA challenge** (`/two-factor`): TOTP, emailed/SMS code or backup code; trusted device for customers only.
- **Forgot / reset password** (`/forgot-password`, `/reset-password`): email link or SMS code (`requestPasswordReset`, `phoneNumber.requestPasswordReset`, `resetPassword`).
- The theme toggle is available on every auth page and in the landing and app headers only (not on Settings).

---

## 4. Protected Shell

### Sidebar (`src/components/app-sidebar.tsx`)
Role-aware navigation:
- **CUSTOMER:** Dashboard, Loan Request, Repayments, Statement, Notifications, Settings
- **MARKETER:** Dashboard, Customers, Notifications, Settings
- **ADMIN / SUPER_ADMIN:** Dashboard, Customers, Loans (Report, Cash, Commodity, Tenure Changes, Top-ups), Commodities, Repayments, Account Officers, Notifications, Settings

### Header (`src/components/user-site-header.tsx`)
Displays user name + avatar. `NavUserLogout` dropdown triggers `logout()`.

---

## 5. Dashboard (`/dashboard`)

Renders different views based on `userRole`:

| Role | Component | Key Data |
|------|-----------|----------|
| `CUSTOMER` | `UserDashboardPage` | `GET /user/overview`, `GET /user/recent-activity` |
| `ADMIN` / `SUPER_ADMIN` | `AdminDashboardPage` | `GET /admin/dashboard`, `GET /admin/dashboard/open-loan-requests`, `GET /admin/dashboard/customers-overview`, `GET /admin/dashboard/disbursement-chart`, `GET /admin/dashboard/status-distribution` |
| `MARKETER` | *(empty)* | — |

**UserDashboardPage** shows:
- Active loan balance, repayment rate, pending count, next deduction date
- Recent activity feed

**AdminDashboardPage** shows:
- KPI cards: total disbursed, outstanding, repaid, revenue
- List of 5 most recent pending loan requests (quick approve/reject actions)
- Area chart: monthly disbursements by year
- Customer overview stats

---

## 6. Customer Management (`/customers`)

**Access:** ADMIN, SUPER_ADMIN, MARKETER

### Customer List (`/customers`)
`GET /admin/customers` — paginated, filterable table.

Filter options: search (name/email/contact/IPPIS ID), status, signup date range, repayment rate range, has active loan, gross/net pay range, account officer, organization.

Actions:
- Click row → navigate to `/customers/[id]`
- "Add Customer" button → `/customers/add-customer`

### Add Customer (`/customers/add-customer`)
Multi-section form (with step-like tabs): User info, Payroll, Identity, Payment Method, and optional Loan.
- `POST /admin/customers`
- Bulk upload via "Upload Existing" → `POST /admin/customers/upload-existing` (XLSX, SUPER_ADMIN only)

### Customer Detail (`/customers/[id]`)
Tabbed view with:
- **Overview** — `GET /admin/customer/:id`, `GET /admin/customer/:id/loans`, `GET /admin/customer/:id/summary`, `GET /admin/customer/:id/active-loan`
- **Identity/Payroll/Payment** — `GET /admin/customer/:id/ppi-info`
- **Repayments** — `GET /admin/customer/:id/repayments` (paginated, status filter)
- **Liquidations** — `GET /admin/customer/:id/liquidation-requests`

Actions available:
- Flag/Activate customer → `PATCH /admin/customer/:id/status`
- Send in-app message → `POST /admin/customer/:id/message`
- Request liquidation → `POST /admin/customer/:id/request-liquidation`
- Generate email report → `POST /admin/customer/:id/generate-report`
- Loan topup → `POST /admin/customer/:id/loan-topup`

---

## 7. Loan Management (`/loans`)

`/loans` immediately redirects to `/loans/report`.

### Loan Report (`/loans/report`)
- `GET /admin/dashboard/loan-report-overview`
- `GET /admin/dashboard/status-distribution`
Displays portfolio overview: principal, interest earned, outstanding balance, status distribution pie chart.

### Cash Loans (`/loans/cash`)
`GET /admin/loans/cash` — paginated table with filters: search, status, category, loan type (New/Topup), has penalties, disbursement date range, request date range.

Clicking a loan row opens a detail panel with approve/disburse/reject actions:
- Approve → `PATCH /admin/loans/cash/:id/approve` (sets tenure)
- Disburse → `PATCH /admin/loans/cash/:id/disburse` (SUPER_ADMIN only)
- Reject → `PATCH /admin/loans/cash/:id/reject`

### Commodity Loans (`/loans/commodity`)
`GET /admin/loans/commodity` — paginated table with filters: search, in review, date range.

Clicking a loan opens detail with approve/reject:
- Approve → `PATCH /admin/loans/commodity/:id/approve` (sets amount, tenure, rates, details)
- Reject → `PATCH /admin/loans/commodity/:id/reject`

---

## 8. Loan Request (`/loan-request`)

**Access:** CUSTOMER only (admin sees a placeholder message)

Customers request loans via a modal:

**Cash Loan:**
- Category selection (dropdown)
- Amount input (min ₦1,000)
- → `POST /user/loan`

**Commodity Loan:**
- Asset name from `/config/commodities`
- → `POST /user/loan/commodity`

Existing PENDING loans can be updated (`PUT /user/loan/:id`) or deleted (`DELETE /user/loan/:id`) from the same page.

---

## 9. Repayments (`/repayments`)

### Customer (`UserRepaymentsPage`)
- Overview: `GET /user/repayments/overview` (total repaid, outstanding, missed count, this month, 12-month chart)
- History: `GET /user/repayments/history?from&to` (period range filter, `YYYY-MM`)
- Liquidation: preview `GET /user/loan/liquidation-preview`, request `POST /user/repayments/liquidation` (multipart with proof, direct upload), history `GET /user/repayments/liquidations`, proof `.../:id/proof`
- Request variation: payroll variations via `/admin/payroll-variations`

### Admin / SUPER_ADMIN (`AdminRepaymentsPage`) — tabs
- **Deductions**: per-period borrower, expected, collected, status
- **Inflows**: `GET /admin/repayments` (payments received, filtered by state/source/period) with `PATCH /admin/repayments/:id/manual-resolution` (`APPLY | SETTLE | REJECT`)
- **Liquidations**: accept/reject `PATCH /admin/repayments/:id/accept-liquidation | reject-liquidation` (proof via signed URL)
- Overview: `GET /admin/repayments/overview?from&to`; upload payroll sheet and validate (SUPER_ADMIN, direct uploads); close period `POST /admin/repayments/close-period` with `{ period: "YYYY-MM" }`

### Other v2 pages
- `/statement` (customer) and the customer page's **Statement** tab: ledger lines with a running balance; PDF/XLSX export is an async job (202) delivered as a notification link.
- Customer page tabs: Top-ups, Tenure Changes, Account Statement, Report (Admin view / Customer view via `report-preview?audience=`).
- `/loans/tenure-changes` (approve/reject proposals; 409 = already decided), `/loans/topups` (approve/reject/disburse), `/commodities` (add, activate/deactivate).

---

## 10. Account Officers (`/account-officers`)

**Access:** ADMIN, SUPER_ADMIN

### Officer List (`/account-officers`)
`GET /admin/account-officer` — table of all account officers.

### Officer Detail (`/account-officers/[officerId]`)
- `GET /admin/account-officer/:id/stats`
- `GET /admin/account-officer/:id/customers` — customers assigned to this officer

---

## 11. Settings (`/settings`)

Views are selected with `?view=`.

### User Settings (`UserSettingsPage`) — CUSTOMER, ADMIN, MARKETER
- **Profile**, **Identity** and **Payment Method** (customers), **Password**, **Security**
- **Security**: change password, 2FA (enable with QR, disable, backup codes), passkeys (customers only), change email/phone, active sessions
- Avatar upload → `POST /user/avatar` (direct upload)

### Admin Settings (`AdminSettingsPage`) — SUPER_ADMIN
Tabs: **General Settings** (maintenance, queues link, rates incl. `maxDeductionRate` via `PATCH /admin/rate`), **Profile Settings** (profile, password, 2FA), **Admin Management** (`GET /admin`, invite, remove).
Until 2FA is on, only the Profile tab is usable and the admin queries are skipped.

---

## 12. Notifications (`/notifications`)

Header bell dialog plus a full page with infinite scroll: `GET /user/notifications`, `PATCH /user/notifications/mark-read`, `PATCH /user/notifications/:id/read`; a row follows `callToActionUrl`.

---

## 13. Configuration Bootstrap

`GET /config` is fetched at app level and provides:
- `maintenanceMode` (boolean)
- `interestRate`, `managementFeeRate`, `penaltyFeeRate`, `maxDeductionRate` (percentages; `null` until set)
- `commodities` (string array)

`GET /config/commodities` is used specifically in the loan request modal asset dropdown.

---

## 14. Data Flow Summary

```
User Action
    │
    ▼
React Component (ui/ page)
    │
    ├── Read data: useQuery(queryOptions) → lib/queries/**
    │                                         │
    │                                         ▼
    │                              api/uploads (cookie session)
    │                                         │
    │                                         ▼
    │                              Response cached in React Query
    │
    └── Write data: useMutation(mutationOptions) → lib/mutations/**
                                              │
                                              ▼
                                   axios.post/patch/put/delete()
                                              │
                                              ▼
                          onSuccess: invalidate queries + toast.success()
```

---

## 15. Role Permission Matrix

| Feature | CUSTOMER | MARKETER | ADMIN | SUPER_ADMIN |
|---------|----------|----------|-------|-------------|
| Dashboard | Personal view | Empty | Full admin view | Full admin view |
| Customers | — | Own list | All customers | All customers |
| Add Customer | — | Yes (flagged) | Yes | Yes |
| Bulk Upload | — | — | — | Yes |
| Cash Loans | — | — | Approve/Reject | Approve/Reject/Disburse |
| Commodity Loans | — | — | Approve/Reject | Approve/Reject |
| Loan Request | Yes | — | — | — |
| Repayments (view) | Own | — | All | All |
| Upload Repayments | — | — | — | Yes |
| Account Officers | — | — | View | View |
| Settings | Profile/Security | Profile/Security | Profile/Security | Full admin settings |
| Invite Admin | — | — | — | Yes |
| Toggle Maintenance | — | — | — | Yes |
