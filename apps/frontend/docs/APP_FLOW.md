# MicroBuilt Frontend — App Flow

> A top-down walkthrough of the application from entry point to each feature.  
> **Stack:** Next.js 15 (App Router) · React Query · Axios · Zod · Shadcn/UI · Tailwind CSS 4

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
- Reads the JWT from localStorage
- Calls `GET /user` to hydrate the session
- If no token → redirects to `/login`
- If on a public page with a token → redirects to `/dashboard`
- Exposes: `user`, `userRole`, `userDetails`, `isUserLoading`, `logout`

The axios instance (`src/lib/axios.ts`) injects `Authorization: Bearer <token>` on every request and clears auth + redirects to `/login` on any `401` response.

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

### Landing Page (`/`)
Static marketing page with a Hero section and Features section. "Get Started" links to `/sign-up`.

### Sign Up (`/sign-up`)
Two-step flow managed by local state in `page.tsx`:

**Step 1 — SignupForm**
- Fields: Full name, Email (optional), Mobile (optional), Password
- Zod validation enforces at least one of email/contact; password must be 8–50 chars with uppercase, lowercase, digit, and special char
- On success → `POST /auth/signup` → transitions to Step 2, passes email down

**Step 2 — VerifyOtpForm**
- 6-digit OTP entry
- `POST /auth/verify-code` with `{ email, code }`
- On success → redirects to `/login`
- Resend button → `POST /auth/resend-code`

### Login (`/login`)
Tab toggle between Email and Mobile login.
- `POST /auth/login` → receives `{ token, user }` → saves token to localStorage → redirects to `/dashboard`

### Forgot Password (`/forgot-password`)
- `POST /auth/forgot-password` with `{ email }` → backend emails a reset link

### Reset Password (`/reset-password`)
- Token read from URL query param
- `POST /auth/reset-password` with `{ token, newPassword }`
- On success → redirects to `/login`

---

## 4. Protected Shell

### Sidebar (`src/components/app-sidebar.tsx`)
Role-aware navigation:
- **CUSTOMER:** Dashboard, Loan Request, Repayments, Notifications, Settings
- **MARKETER:** Dashboard, Customers, Notifications, Settings
- **ADMIN / SUPER_ADMIN:** Dashboard, Customers, Loans (Cash + Commodity + Report), Repayments, Account Officers, Notifications, Settings

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

Role-based:

### Customer (`UserRepaymentsPage`)
- Overview cards: `GET /user/repayments/overview` — total paid, rate, overdue count, next date
- History table: `GET /user/repayments/history` (paginated, status filter)
- Yearly area chart: `GET /user/repayments?year=YYYY`
- Request variation: `POST /admin/repayments/variation`

### Admin / SUPER_ADMIN (`AdminRepaymentsPage`)
- Overview: `GET /admin/repayments/overview` — total overdue, repaid, underpaid, failed
- Repayments table: `GET /admin/repayments` (paginated, rich filters)
- Upload IPPIS repayment file: `POST /admin/repayments/upload` (XLSX, SUPER_ADMIN only)
- Accept/reject liquidations: `PATCH /admin/repayments/:id/accept-liquidation` / `reject-liquidation`

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

Role-based:

### User Settings (`UserSettingsPage`) — CUSTOMER, ADMIN, MARKETER
Three tabs:
- **Identity** — displays/edits: gender, DOB, address, state, landmark, marital status, next of kin info → `PATCH /user/identity`
- **Payment Method** — displays bank name, account number, account name (read-only in UI)
- **Password** — `PATCH /user/password`

Avatar upload in the header → `POST /user/avatar`

### Admin Settings (`AdminSettingsPage`) — SUPER_ADMIN
Four tabs:
- **Rates** — Interest rate, management fee, penalty rate → `PATCH /admin/rate`; reads from `GET /config`
- **Commodities** — Add/delete commodity names → `POST /admin/commodities` / `DELETE /admin/commodities`
- **Admins** — List all admins (`GET /admin`), invite new → `POST /admin/invite-admin`, remove → `PATCH /admin/remove-admin`
- **Maintenance** — Toggle on/off → `PATCH /admin/maintenance`

---

## 12. Notifications (`/notifications`)

Placeholder page. No API integration visible.

---

## 13. Configuration Bootstrap

`GET /config` is fetched at app level and provides:
- `maintenanceMode` (boolean)
- `interestRate`, `managementFeeRate`, `penaltyFeeRate` (percentages)
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
    │                              axios.get() with Bearer token
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
| Settings | Identity/Password | Identity/Password | Identity/Password | Full admin settings |
| Invite Admin | — | — | — | Yes |
| Toggle Maintenance | — | — | — | Yes |
