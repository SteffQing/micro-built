# MicroBuilt — Frontend API Reference

> **Base URL:** `https://api.microbuiltprime.com` (or `http://localhost:3003` locally)  
> **Swagger UI:** `{baseUrl}/api`  
> **Auth:** All protected endpoints require `Authorization: Bearer <jwt_token>` header.  
> **Global validation:** `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — unknown fields are stripped and rejected.

---

## Table of Contents

1. [Auth](#1-auth)
2. [Public Config](#2-public-config)
3. [User — Profile](#3-user--profile)
4. [User — Identity](#4-user--identity)
5. [User — Payroll](#5-user--payroll)
6. [User — Payment Method](#6-user--payment-method)
7. [User — Loans](#7-user--loans)
8. [User — Repayments](#8-user--repayments)
9. [Admin — Super Admin Actions](#9-admin--super-admin-actions)
10. [Admin — Customers List](#10-admin--customers-list)
11. [Admin — Customer Detail](#11-admin--customer-detail)
12. [Admin — Cash Loans](#12-admin--cash-loans)
13. [Admin — Commodity Loans](#13-admin--commodity-loans)
14. [Admin — Repayments](#14-admin--repayments)
15. [Admin — Dashboard](#15-admin--dashboard)
16. [Enums & Shared Types](#16-enums--shared-types)
17. [Business Rules](#17-business-rules)

---

## 1. Auth

> **Prefix:** `/auth`  
> No authentication required unless noted.

---

### POST `/auth/signup`

Create a new customer account.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Full name |
| `email` | string | one of | Valid email; auto-lowercased |
| `contact` | string | one of | Nigerian phone number (NG format) |
| `password` | string | yes | 8–50 chars; must include uppercase, lowercase, digit, and special char (`@$!%*?&`) |

At least one of `email` or `contact` must be provided.

**Response `201`:**
```json
{
  "data": { "userId": "MB-123456" },
  "message": "Signup successful. Verification code sent to your email."
}
```

**Notable errors:** `409` email already exists · `400` weak password / invalid phone.

---

### POST `/auth/login`

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | one of | Auto-lowercased |
| `contact` | string | one of | Nigerian phone |
| `password` | string | yes | |

**Response `200`:**
```json
{
  "data": {
    "token": "<jwt>",
    "user": { "id": "MB-123456", "role": "CUSTOMER" }
  },
  "message": "Welcome back to MicroBuilt, John!"
}
```

**Notable errors:** `404` user not found · `401` wrong credentials.

---

### POST `/auth/verify-code`

Verify email with 6-digit code (sent on signup).

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | yes | Auto-lowercased |
| `code` | string | yes | Exactly 6 characters |

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "Account activated successfully" }
```

---

### POST `/auth/resend-code`

Resend verification email code.

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "Code resent successfully" }
```

---

### POST `/auth/forgot-password`

Send password reset link/token to email.

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |

**Response `200`:**
```json
{ "data": { "email": "user@example.com" }, "message": "Password reset code sent successfully" }
```

---

### POST `/auth/reset-password`

Complete password reset.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `token` | string | yes | From reset email |
| `newPassword` | string | yes | Same strength rules as signup password |

**Response `200`:**
```json
{ "data": { "email": "user@example.com" }, "message": "Password reset successful" }
```

**Notable errors:** `401` invalid/expired token.

---

## 2. Public Config

> **Prefix:** `/config`  
> No authentication required.

---

### GET `/config`

Get all public platform configuration at once.

**Response `200`:**
```json
{
  "data": {
    "maintenanceMode": false,
    "interestRate": 5.5,
    "managementFeeRate": 3.0,
    "penaltyFeeRate": 1.5,
    "commodities": ["Laptop", "Solar Panel", "Generator"]
  },
  "message": "Public config returned"
}
```

> All rates are returned as **percentages** (e.g. `5.5` means 5.5%).

---

### GET `/config/commodities`

Returns the list of commodity names available for asset loans.

**Response `200`:**
```json
{ "data": ["Laptop", "Solar Panel"], "message": "Commodity categories returned" }
```

---

### GET `/config/interest-rate`

Returns the current annual interest rate as a percentage.

---

### GET `/config/management-fee-rate`

Returns the current management fee rate as a percentage.

---

### GET `/config/maintenance-mode`

Returns whether the platform is in maintenance mode.

**Response `200`:**
```json
{ "data": false, "message": "Maintenance mode returned" }
```

---

## 3. User — Profile

> **Prefix:** `/user`  
> Requires JWT. Role: `CUSTOMER`.

---

### GET `/user`

Get the current user's profile.

**Response `200`:**
```json
{
  "data": {
    "id": "MB-Z891W",
    "name": "John Doe",
    "email": "john@example.com",
    "contact": "08012345678",
    "status": "ACTIVE",
    "role": "CUSTOMER",
    "avatar": "https://..."
  },
  "message": "Profile data for John Doe has been successfully queried"
}
```

---

### PATCH `/user/password`

Change password while logged in.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `oldPassword` | string | yes | Current password |
| `newPassword` | string | yes | 8–50 chars; uppercase + lowercase + digit |

**Response `200`:**
```json
{ "data": null, "message": "Password has been successfully updated" }
```

**Notable errors:** `401` old password incorrect.

---

### POST `/user/avatar`

Upload a profile avatar. `multipart/form-data`.

| Field | Notes |
|-------|-------|
| `file` | Image file only (`image/*`); max **3 MB** |

**Response `201`:**
```json
{ "data": { "url": "https://..." }, "message": "Avatar has been successfully updated!" }
```

---

### GET `/user/overview`

Dashboard overview — active loans summary, pending count, last deduction, next repayment date, repayment rate.

---

### GET `/user/recent-activity`

Recent activity feed.

**Response `200`:**
```json
{
  "data": [
    {
      "title": "Loan Repayment",
      "description": "₦25,000 used to repay loan LN-E111.",
      "date": "2025-04-20T10:30:00Z",
      "source": "Repayment"
    }
  ],
  "message": "User activity successfully queried"
}
```

---

## 4. User — Identity

> **Prefix:** `/user/identity`  
> Requires JWT.

---

### GET `/user/identity`

Get submitted identity information.

---

### POST `/user/identity`

Submit identity for verification.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `dateOfBirth` | string (ISO-8601) | yes | e.g. `"1990-01-15"` |
| `residencyAddress` | string | yes | |
| `stateResidency` | string | yes | |
| `landmarkOrBusStop` | string | yes | |
| `nextOfKinName` | string | yes | |
| `nextOfKinContact` | string | yes | Nigerian phone |
| `nextOfKinAddress` | string | yes | |
| `nextOfKinRelationship` | enum | yes | `Sibling` `Parent` `Spouse` `Child` `Grandparent` `Other` |
| `gender` | enum | yes | `Male` `Female` `Other` |
| `maritalStatus` | enum | yes | `Single` `Married` `Divorced` `Widowed` |

**Response `201`:**
```json
{ "data": null, "message": "Your identity documents have been successfully created! Please wait as we manually review this information" }
```

**Notable errors:** `400` identity already exists.

---

### PATCH `/user/identity`

Update identity. All fields optional (PartialType of create).

**Response `200`:**
```json
{ "data": null, "message": "Your identity documents have been successfully updated!" }
```

---

## 5. User — Payroll

> **Prefix:** `/user/payroll`  
> Requires JWT.

---

### GET `/user/payroll`

Returns payroll data if it exists.

---

### POST `/user/payroll`

Create payroll record.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `externalId` | string | yes | IPPIS staff ID — must match the platform's records |
| `grade` | string | no | |
| `step` | number | no | |
| `command` | string | yes | |
| `organization` | string | yes | |

**Response `201`:**
```json
{ "data": null, "message": "User payroll data created" }
```

**Notable errors:** `404` IPPIS ID not found in platform records.

---

### PATCH `/user/payroll`

Update payroll (all fields optional, `externalId` excluded).

**Response `200`:**
```json
{ "data": null, "message": "User payroll data updated" }
```

---

## 6. User — Payment Method

> **Prefix:** `/user/payment-method`  
> Requires JWT.

---

### GET `/user/payment-method`

**Response `200`:**
```json
{
  "data": {
    "bankName": "Access Bank",
    "accountNumber": "0123456789",
    "accountName": "John Doe"
  },
  "message": "Payment methods have been successfully queried"
}
```

---

### POST `/user/payment-method`

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `bankName` | string | yes | |
| `accountNumber` | string | yes | Exactly 10 digits |
| `accountName` | string | yes | Must match identity name |
| `bvn` | string | yes | Exactly 11 digits |

**Response `201`:**
```json
{ "data": null, "message": "Payment method has been successfully created and added!" }
```

**Notable errors:** `409` already exists · `422` account name mismatch.

---

### PATCH `/user/payment-method`

All fields optional.

**Response `200`:**
```json
{ "data": null, "message": "Payment method has been successfully updated." }
```

---

## 7. User — Loans

> **Prefix:** `/user/loan`  
> Requires JWT.

---

### GET `/user/loan`

Loan request history with status filter.

**Query:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | `LoanStatus` | — | Optional filter |
| `page` | number | `1` | |
| `limit` | number | `10` | |

---

### POST `/user/loan`

Apply for a cash loan.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `amount` | number | yes | Positive, in Naira |
| `category` | `LoanCategory` | yes | Any category value (see [Enums](#16-enums--shared-types)) |

**Response `201`:**
```json
{ "data": { "id": "LN_Q30E22" }, "message": "Loan application submitted successfully" }
```

**Notable errors:** `400` already has pending loan · `400` rate not configured · `400` flagged account.

---

### GET `/user/loan/overview`

Pending loans and loan status counts.

---

### GET `/user/loan/all`

All loans (cash + commodity combined), sorted by date.

**Query:** `page` (default 1), `limit` (default 10)

---

### GET `/user/loan/:loanId`

Single cash loan detail.

---

### PUT `/user/loan/:loanId`

Update a **PENDING** loan. All body fields optional.

**Body:** Same shape as POST `/user/loan`.

**Response `200`:**
```json
{ "data": null, "message": "Loan application updated successfully" }
```

**Notable errors:** `400` only PENDING loans can be modified.

---

### DELETE `/user/loan/:loanId`

Delete a **PENDING** loan.

**Response `200`:**
```json
{ "data": null, "message": "Loan deleted successfully" }
```

---

### POST `/user/loan/commodity`

Request a commodity/asset loan.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `assetName` | string | yes | Must exist in commodity list from `/config/commodities` |

**Response `201`:**
```json
{ "data": { "id": "CA-XXXX" }, "message": "You have successfully requested a commodity loan for Laptop!" }
```

**Notable errors:** `400` no commodities configured · `400` asset not in inventory.

---

### GET `/user/loan/commodity`

Commodity loan history.

**Query:** `page`, `limit`

---

### GET `/user/loan/commodity/:cLoanId`

Single commodity loan detail.

---

## 8. User — Repayments

> **Prefix:** `/user/repayments`  
> Requires JWT.

---

### GET `/user/repayments`

Yearly repayment summary (monthly breakdown).

**Query:**

| Param | Type | Notes |
|-------|------|-------|
| `year` | number | Defaults to current year |

---

### GET `/user/repayments/overview`

Repayment overview — total paid, amounts, repayment rate.

---

### GET `/user/repayments/history`

Repayment history.

**Query:**

| Param | Type | Default |
|-------|------|---------|
| `status` | `RepaymentStatus` | — |
| `page` | number | `1` |
| `limit` | number | `10` |

---

### GET `/user/repayments/:id`

Single repayment detail.

---

## 9. Admin — Super Admin Actions

> **Prefix:** `/admin`  
> Requires JWT. Role: `SUPER_ADMIN` unless noted.

---

### GET `/admin`

List all admin users.

**Role:** `SUPER_ADMIN`

---

### POST `/admin/invite-admin`

Invite a new admin or marketer.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | yes | Auto-lowercased |
| `name` | string | yes | |
| `role` | enum | yes | `ADMIN` `SUPER_ADMIN` `MARKETER` |

**Response `200`:**
```json
{ "data": null, "message": "John Doe has been successfully invited" }
```

---

### PATCH `/admin/remove-admin`

Remove an admin.

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `id` | string | yes |

---

### PATCH `/admin/rate`

Update a platform rate.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `key` | enum | yes | `INTEREST_RATE` · `MANAGEMENT_FEE_RATE` · `PENALTY_FEE_RATE` |
| `value` | number | yes | 1–100 (percentage) |

**Response `200`:**
```json
{ "data": null, "message": "INTEREST RATE has been updated" }
```

---

### PATCH `/admin/maintenance`

Toggle maintenance mode on/off.

**Role:** `SUPER_ADMIN`

**Response `200`:**
```json
{ "data": null, "message": "Maintenance mode is now On. All platform actions are currently paused" }
```

---

### POST `/admin/commodities`

Add a commodity.

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | yes |

---

### DELETE `/admin/commodities`

Remove a commodity.

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | yes |

---

## 10. Admin — Customers List

> **Prefix:** `/admin/customers`  
> Requires JWT. Role: `ADMIN` or `SUPER_ADMIN` unless noted.

---

### GET `/admin/customers/overview`

Platform-wide customer metrics.

---

### GET `/admin/customers`

Paginated customer list with rich filtering.

**Query (all optional):**

| Param | Type | Notes |
|-------|------|-------|
| `page` | number | Default `1` |
| `limit` | number | Default `20` |
| `search` | string | Name, email, contact, or IPPIS ID |
| `status` | `UserStatus` | `ACTIVE` · `INACTIVE` · `FLAGGED` |
| `signupStart` | ISO-8601 | Signed up after |
| `signupEnd` | ISO-8601 | Signed up before |
| `repaymentRateMin` | number | 0–100 |
| `repaymentRateMax` | number | 0–100 |
| `hasActiveLoan` | boolean | |
| `grossPayMin` | number | |
| `grossPayMax` | number | |
| `netPayMin` | number | |
| `netPayMax` | number | |
| `accountOfficerId` | string | |
| `organization` | string | |

---

### GET `/admin/customers/organizations`

Unique organizations across all customers.

**Role:** `ADMIN` · `SUPER_ADMIN` · `MARKETER`

**Response `200`:**
```json
{
  "data": [
    { "name": "NPF", "id": "NPF" },
    { "name": "Nigerian Navy", "id": "Nigerian Navy" }
  ],
  "message": "Unique Organizations fetched successfully"
}
```

---

### POST `/admin/customers`

Onboard a new customer manually.

**Role:** `ADMIN` · `SUPER_ADMIN` · `MARKETER`

**Body:**

```jsonc
{
  "user": {
    "name": "Jane Doe",           // required
    "email": "jane@example.com",  // optional (one of email/contact)
    "contact": "08012345678"      // optional
  },
  "payroll": { /* CreatePayrollDto */ },
  "identity": { /* CreateIdentityDto */ },
  "paymentMethod": { /* CreatePaymentMethodDto */ },
  "loan": {                       // optional
    "category": "PERSONAL",       // LoanCategory
    "cashLoan": {                 // required when category != ASSET_PURCHASE
      "amount": 100000,
      "tenure": 6
    },
    "commodityLoan": {            // required when category == ASSET_PURCHASE
      "assetName": "Laptop"
    }
  }
}
```

> Customers onboarded by a `MARKETER` start with status `FLAGGED` and need admin review before activation.

---

### POST `/admin/customers/upload-existing`

Bulk-upload existing customers from Excel. `multipart/form-data`.

**Role:** `SUPER_ADMIN`

| Field | Notes |
|-------|-------|
| `file` | `.xlsx` / `.xls`; max **10 MB** |

---

### GET `/admin/account-officer`

All account officers.

---

### GET `/admin/account-officer/me`

Current officer's assigned customers (same filters as customer list).

**Role:** `ADMIN` · `SUPER_ADMIN` · `MARKETER`

---

### GET `/admin/account-officer/:id/customers`

Customers assigned to a specific officer.

---

### GET `/admin/account-officer/:id/stats`

Signup statistics for an account officer.

---

## 11. Admin — Customer Detail

> **Prefix:** `/admin/customer/:id`  
> Requires JWT. Role: `ADMIN` · `SUPER_ADMIN` · `MARKETER` unless noted.

All endpoints use the customer's user `id` as `:id`.

---

### GET `/admin/customer/:id`

Full customer profile.

---

### GET `/admin/customer/:id/loans`

Customer's active and pending loans.

---

### GET `/admin/customer/:id/summary`

Loan summary — outstanding balance, total borrowed, repayment flags.

---

### GET `/admin/customer/:id/repayments`

Customer's repayment history.

**Query:** `status` (RepaymentStatus), `page`, `limit`

---

### GET `/admin/customer/:id/ppi-info`

Payroll, Payment Method, and Identity combined.

---

### GET `/admin/customer/:id/payment-method`

Payment method only.

---

### GET `/admin/customer/:id/identity`

Identity record only.

---

### GET `/admin/customer/:id/payroll`

Payroll record only.

---

### GET `/admin/customer/:id/active-loan`

Current active (DISBURSED) loan aggregated data, or `null`.

---

### PATCH `/admin/customer/:id/status`

Change customer status.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `status` | `UserStatus` | yes | `ACTIVE` · `INACTIVE` · `FLAGGED` |
| `reason` | string | no | Required context when flagging |

**Response `200`:**
```json
{ "data": null, "message": "John Doe has been flagged!" }
```

---

### POST `/admin/customer/:id/message`

Send an in-app notification message to the customer.

**Body:**

| Field | Type | Required | Max length |
|-------|------|----------|------------|
| `title` | string | yes | 100 |
| `message` | string | yes | 1000 |

---

### POST `/admin/customer/:id/request-liquidation`

Create a liquidation request for the customer.

**Role:** `ADMIN` · `SUPER_ADMIN`

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `amount` | number | yes | Positive, in Naira |

---

### GET `/admin/customer/:id/liquidation-requests`

List all liquidation requests for this customer.

**Query:** `status` (`LiquidationStatus`), `page`, `limit`

---

### POST `/admin/customer/:id/generate-report`

Queue a customer loan report to be emailed.

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |

---

### POST `/admin/customer/:id/loan-topup`

Issue a top-up loan to an existing customer.

**Role:** `ADMIN` · `SUPER_ADMIN`

**Body:** Same shape as the `loan` object in onboard customer:

```jsonc
{
  "category": "PERSONAL",
  "cashLoan": { "amount": 50000, "tenure": 3 },
  // OR
  "commodityLoan": { "assetName": "Laptop" }
}
```

---

## 12. Admin — Cash Loans

> **Prefix:** `/admin/loans/cash`  
> Requires JWT. Role: `ADMIN` · `SUPER_ADMIN`.

---

### GET `/admin/loans/cash`

Paginated cash loans.

**Query (all optional):**

| Param | Type | Notes |
|-------|------|-------|
| `page` | number | Default `1` |
| `limit` | number | Default `20` |
| `search` | string | Customer name, email, contact, IPPIS ID |
| `status` | `LoanStatus` | |
| `category` | `LoanCategory` | Excludes `ASSET_PURCHASE` |
| `type` | `LoanType` | `New` or `Topup` |
| `hasPenalties` | boolean | |
| `hasCommodityLoan` | boolean | |
| `disbursementStart` | ISO-8601 | |
| `disbursementEnd` | ISO-8601 | |
| `requestedStart` | ISO-8601 | |
| `requestedEnd` | ISO-8601 | |

---

### GET `/admin/loans/cash/:id`

Single cash loan detail.

---

### PATCH `/admin/loans/cash/:id/approve`

Set loan terms (moves status `PENDING → APPROVED`).

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tenure` | number | yes | Months, min 1 |

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "Loan approved successfully" }
```

---

### PATCH `/admin/loans/cash/:id/disburse`

Disburse loan (moves status `APPROVED → DISBURSED`).

**Role:** `SUPER_ADMIN` only.

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "Loan disbursed successfully" }
```

**Notable errors:** `417` loan not approved · `400` customer is FLAGGED.

---

### PATCH `/admin/loans/cash/:id/reject`

Reject a loan.

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "Loan rejected successfully" }
```

**Notable errors:** `417` cannot reject a DISBURSED or REPAID loan.

---

## 13. Admin — Commodity Loans

> **Prefix:** `/admin/loans/commodity`  
> Requires JWT. Role: `ADMIN` · `SUPER_ADMIN`.

---

### GET `/admin/loans/commodity`

Paginated commodity loan list.

**Query (all optional):**

| Param | Type | Notes |
|-------|------|-------|
| `page` | number | Default `1` |
| `limit` | number | Default `20` |
| `search` | string | Asset name or customer fields |
| `inReview` | boolean | `true` = still pending admin review |
| `requestedStart` | ISO-8601 | |
| `requestedEnd` | ISO-8601 | |

---

### GET `/admin/loans/commodity/:id`

Single commodity loan detail (includes linked cash loan if approved).

---

### PATCH `/admin/loans/commodity/:id/approve`

Approve and set terms for a commodity loan. Creates a linked cash loan internally.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `publicDetails` | string | yes | Visible to customer |
| `privateDetails` | string | yes | Internal only |
| `amount` | number | yes | Principal in Naira |
| `tenure` | number | yes | Months, min 1 |
| `managementFeeRate` | number | yes | 1–100 |
| `interestRate` | number | yes | 1–100 |

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "Commodity Loan has been approved" }
```

---

### PATCH `/admin/loans/commodity/:id/reject`

Reject a commodity loan.

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "Commodity Loan has been rejected." }
```

---

## 14. Admin — Repayments

> **Prefix:** `/admin/repayments`  
> Requires JWT. Role: `ADMIN` · `SUPER_ADMIN` unless noted.

---

### GET `/admin/repayments/overview`

Platform-wide repayment summary.

**Response `200`:**
```json
{
  "data": {
    "totalOverdue": 1250000.00,
    "totalRepaid": 8750000.00,
    "underpaidAmount": 350000.00,
    "failedDeductionsAmount": 900000.00
  },
  "message": "Platform-wide repayment overview fetched successfully"
}
```

> `underpaidAmount` — total expected from PARTIAL repayments  
> `failedDeductionsAmount` — total expected from FAILED repayments

---

### GET `/admin/repayments`

Paginated repayments list.

**Query (all optional):**

| Param | Type | Notes |
|-------|------|-------|
| `page` | number | Default `1` |
| `limit` | number | Default `20` |
| `status` | `RepaymentStatus` | |
| `hasPenaltyCharge` | boolean | |
| `search` | string | Customer name, email, contact, IPPIS ID |
| `periodStart` | ISO-8601 | |
| `periodEnd` | ISO-8601 | |
| `repaidAmountMin` | number | |
| `repaidAmountMax` | number | |

---

### GET `/admin/repayments/:id`

Single repayment with payer info.

---

### PATCH `/admin/repayments/:id/manual-resolution`

Manually resolve a `MANUAL_RESOLUTION` status repayment.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `resolutionNote` | string | yes | Explanation of manual resolution |
| `userId` | string | conditional | Required when repayment has no linked user (unknown IPPIS ID case) |
| `loanId` | string | conditional | Required when repayment is an overflow (has a user but no loan) |

**Response `200`:**
```json
{ "data": null, "message": "Repayment status has been manually resolved!" }
```

---

### POST `/admin/repayments/upload`

Upload IPPIS repayment spreadsheet for batch processing.

**Role:** `SUPER_ADMIN`

**Multipart form fields:**

| Field | Notes |
|-------|-------|
| `file` | Excel `.xlsx` / `.xls`; max **10 MB** |
| `period` | String: `"APRIL 2025"` — month name + space + 4-digit year (case-insensitive) |

**Response `200`:**
```json
{ "data": null, "message": "Repayment has been queued for processing" }
```

**Notable errors:** `400` period already processed · `400` invalid Excel headers.

---

### POST `/admin/repayments/validate`

Validate a repayment Excel file without processing it.

**Multipart form fields:**

| Field | Notes |
|-------|-------|
| `file` | Excel file; max 10 MB |

**Response `200`:**
```json
{
  "data": {
    "headers": { "valid": true, "missing": [] },
    "rows": { "valid": true, "issues": [] }
  }
}
```

---

### POST `/admin/repayments/variation`

Generate (and optionally save) the monthly loan variation schedule.

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `period` | string | yes | `"APRIL 2025"` format |
| `email` | string | yes | Receives the report |
| `save` | boolean | no | Only SUPER_ADMIN can save; only allowed on/after the 28th of the month |

---

### PATCH `/admin/repayments/:id/reject-liquidation`

Reject a pending liquidation request.

**Role:** `SUPER_ADMIN`

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "The liquidation has been marked as rejected." }
```

---

### PATCH `/admin/repayments/:id/accept-liquidation`

Accept and queue a liquidation request for processing.

**Role:** `SUPER_ADMIN`

**Response `200`:**
```json
{ "data": { "userId": "MB-123456" }, "message": "Liquidation request has been accepted and queued for processing!" }
```

---

## 15. Admin — Dashboard

> **Prefix:** `/admin/dashboard`  
> Requires JWT. Role: `ADMIN` · `SUPER_ADMIN`.

---

### GET `/admin/dashboard`

Key platform metrics (total disbursed, outstanding, repaid, revenue figures).

---

### GET `/admin/dashboard/disbursement-chart`

Monthly disbursement chart data.

**Query:** `year` (number, defaults to current year)

---

### GET `/admin/dashboard/open-loan-requests`

5 most recent PENDING loan requests.

---

### GET `/admin/dashboard/customers-overview`

Customer count by status.

---

### GET `/admin/dashboard/status-distribution`

Loan count by status.

---

### GET `/admin/dashboard/loan-report-overview`

Loan portfolio overview (principal, interest, outstanding etc.).

---

## 16. Enums & Shared Types

### `LoanStatus`
```
PENDING | APPROVED | DISBURSED | REJECTED | REPAID
```

### `LoanCategory`
```
PERSONAL | BUSINESS | EDUCATION | MEDICAL | UTILITIES | ASSET_PURCHASE
```
> `ASSET_PURCHASE` is used internally for commodity loans.

### `UserStatus`
```
ACTIVE | INACTIVE | FLAGGED
```

### `UserRole`
```
SUPER_ADMIN | ADMIN | MARKETER | CUSTOMER
```

### `RepaymentStatus`
```
AWAITING | FULFILLED | PARTIAL | FAILED | MANUAL_RESOLUTION
```

### `LiquidationStatus`
```
PENDING | REVEIWING | APPROVED | REJECTED
```
> Note: `REVEIWING` is a typo in the DB enum — use it exactly as spelled.

### `NextOfKinRelationship`
```
Sibling | Parent | Spouse | Child | Grandparent | Other
```

### `Gender`
```
Male | Female | Other
```

### `MaritalStatus`
```
Single | Married | Divorced | Widowed
```

### `Period` string format
Used in repayment upload and variation schedule:
```
"APRIL 2025"   ← full month name (case-insensitive) + space + 4-digit year
```

### Paginated response shape
All paginated endpoints return:
```json
{
  "data": [...],
  "meta": { "total": 120, "page": 1, "limit": 20 },
  "message": "..."
}
```

### Non-paginated response shape
```json
{
  "data": { ... } | null,
  "message": "..."
}
```

---

## 17. Business Rules

### User lifecycle
```
INACTIVE → (email verify code) → FLAGGED → (admin review/onboard) → ACTIVE
```
- Users with no email (contact-only) skip email verification and start as `FLAGGED`.
- Customers onboarded by a `MARKETER` also start as `FLAGGED`.

### Loan lifecycle
```
PENDING → APPROVED (admin sets tenure) → DISBURSED (super admin) → REPAID
                ↘ REJECTED (any status before DISBURSED)
```
- Only the loan owner can update/delete their own PENDING loan.
- Only `SUPER_ADMIN` can disburse.
- A `FLAGGED` customer cannot have loans disbursed.

### Commodity loan lifecycle
```
inReview: true (customer requests) → approved (admin sets terms) or rejected
```
- Approving a commodity loan creates a linked cash loan internally and immediately approves it.
- The linked cash loan still needs disbursement separately.

### Password requirements
- 8–50 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- Signup/reset additionally require 1 special character (`@$!%*?&`)

### File uploads
| Endpoint | Type | Max size |
|----------|------|----------|
| Avatar | `image/*` | 3 MB |
| Repayment Excel | `.xlsx` / `.xls` | 10 MB |
| Customer bulk upload | `.xlsx` / `.xls` | 10 MB |

### Rates
- All rates are stored internally as decimals (e.g. `0.055` for 5.5%).
- All rate endpoints **accept and return percentages** (e.g. `5.5`).
- Interest is flat-rate (add-on): `repayable = principal × (1 + rate × tenure)`.

### Repayment period deduplication
Uploading a repayment file for a period that has already been processed returns `400 Bad Request`. The UI should check this before allowing re-upload.

### Manual resolution scenarios
There are two kinds of `MANUAL_RESOLUTION` repayments:
1. **Unknown user** — IPPIS ID in the file didn't match any customer. Provide `userId` when resolving.
2. **Overflow** — Customer paid more than owed; excess sits in `MANUAL_RESOLUTION`. Provide `loanId` when resolving.

### Liquidation request flow
```
PENDING → REVEIWING (admin accepts) → APPROVED or REJECTED (queue processes)
        ↘ REJECTED (admin rejects directly)
```

### Maintenance mode
- When `maintenanceMode: true`, all non-auth requests return 503.
- Only `SUPER_ADMIN` with the `BypassMaintenance` flag can toggle it.
- The `/auth/login` endpoint bypasses maintenance mode so admins can still log in.
