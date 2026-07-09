# MicroBuilt Loan System — Full Technical Flow

> Complete walkthrough from customer onboarding through repayment, with API examples.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Data Models Summary](#2-data-models-summary)
3. [User Eligibility Prerequisites](#3-user-eligibility-prerequisites)
4. [Phase 1 — Customer Onboarding](#4-phase-1--customer-onboarding)
5. [Phase 2 — Loan Request](#5-phase-2--loan-request)
6. [Phase 3 — Admin Review & Approval](#6-phase-3--admin-review--approval)
7. [Phase 4 — Disbursement](#7-phase-4--disbursement)
8. [Phase 5 — Monthly Repayment Processing](#8-phase-5--monthly-repayment-processing)
9. [Phase 6 — Manual Resolution & Overflow](#9-phase-6--manual-resolution--overflow)
10. [Phase 7 — Loan Liquidation (Early Payoff)](#10-phase-7--loan-liquidation-early-payoff)
11. [Loan Financial Maths](#11-loan-financial-maths)
12. [Real-World End-to-End Example](#12-real-world-end-to-end-example)
13. [Commodity (Asset) Loan Flow](#13-commodity-asset-loan-flow)
14. [Topup Loan Flow](#14-topup-loan-flow)
15. [Global Config Counters](#15-global-config-counters)
16. [Event & Queue Architecture](#16-event--queue-architecture)

---

## 1. System Architecture

```
HTTP Request
    │
    ▼
Controller (validates auth, roles, body)
    │
    ├── Service (business logic, DB checks)
    │       │
    │       ├── Direct DB writes (Prisma) for synchronous operations
    │       │
    │       └── EventEmitter2.emit() for fire-and-forget operations
    │               │
    │               └── @OnEvent listener (events.service.ts / events.admin.ts)
    │                       │
    │                       └── Prisma DB write
    │
    └── QueueProducer.add() for heavy async jobs
            │
            └── BullMQ Consumer (queue.repayments.ts / queue.reports.ts)
                        │
                        └── Prisma DB writes + Config updates
```

**Key design principle:** Controllers validate input and check preconditions. All writes that can fail silently go through `@OnEvent` listeners. Heavy processing (Excel parsing, report generation) goes through BullMQ. This makes the HTTP response fast but means failures in event listeners and queue jobs are invisible to the caller.

---

## 2. Data Models Summary

### Loan
| Field | Type | Notes |
|-------|------|-------|
| `id` | String | Custom generated ID |
| `principal` | Decimal(10,2) | Amount requested |
| `repayable` | Decimal(10,2) | Set at disbursement = `principal × (1 + interestRate × tenure)` |
| `repaid` | Decimal(10,2) | Cumulative principal + interest paid |
| `penalty` | Decimal(10,2) | Cumulative penalties accrued |
| `penaltyRepaid` | Decimal(10,2) | Cumulative penalties paid |
| `interestRate` | Decimal(5,4) | Monthly flat rate, e.g. `0.0600` = 6% |
| `managementFeeRate` | Decimal(5,4) | Origination fee rate, e.g. `0.0300` = 3% |
| `tenure` | Int | Original loan term in months |
| `extension` | Int | Extra months added due to partial/missed payments |
| `status` | LoanStatus | `PENDING → APPROVED → DISBURSED → REPAID` (or `REJECTED`) |
| `type` | LoanType | `New` or `Topup` |
| `disbursementDate` | DateTime? | Set when loan is disbursed |

### Repayment
| Field | Type | Notes |
|-------|------|-------|
| `id` | String | Custom generated ID |
| `period` | String | E.g. `"APRIL 2025"` |
| `periodInDT` | DateTime | Parsed date for DB queries |
| `amount` | Decimal | Total amount received from IPPIS for this user in the period |
| `expectedAmount` | Decimal | What was due (monthly payment + outstanding penalty) |
| `repaidAmount` | Decimal | What was actually credited to this repayment |
| `penaltyCharge` | Decimal | Penalty that accrued on this repayment (added on failure) |
| `status` | RepaymentStatus | `AWAITING → FULFILLED/PARTIAL/FAILED/MANUAL_RESOLUTION` |
| `loanId` | String? | null for MANUAL_RESOLUTION records without a matched user |
| `userId` | String? | null for unmatched IPPIS records |

### CommodityLoan
| Field | Type | Notes |
|-------|------|-------|
| `name` | String | Asset name (must match `COMMODITY_CATEGORIES` config) |
| `inReview` | Boolean | `true` = still pending admin action |
| `publicDetails` | String? | Set by admin on approval (visible to customer) |
| `privateDetails` | String? | Set by admin on approval (internal only) |
| `loanId` | String? @unique | Links to `Loan` once admin approves |

### LiquidationRequest
| Field | Type | Notes |
|-------|------|-------|
| `totalAmount` | Decimal | Amount the customer wants to pay to settle early |
| `status` | LiquidationStatus | `PENDING → APPROVED/REJECTED` |
| `approvedAt` | DateTime? | Set by queue consumer when processing completes |

---

## 3. User Eligibility Prerequisites

Before a customer can request any loan, these three records must exist and the user must be `ACTIVE` status:

| Prerequisite | Endpoint to create | Effect on user status |
|---|---|---|
| `UserIdentity` | `POST /user/ppi/identity` | Sets user `FLAGGED` |
| `UserPaymentMethod` | `POST /user/ppi/payment-method` | Sets user `FLAGGED` |
| `UserPayroll` | `POST /user/ppi/payroll` | Sets user `FLAGGED` + writes `externalId` |

After each document upload, the user is set to `FLAGGED`. An admin must manually set the user to `ACTIVE` (`PATCH /admin/customer/:id/status`) before loan requests are accepted.

Additionally, these Config keys must have non-zero values:
- `INTEREST_RATE` — monthly flat interest rate
- `MANAGEMENT_FEE_RATE` — origination fee
- `PENALTY_FEE_RATE` — used during repayment processing
- `COMMODITY_CATEGORIES` — comma-separated list (for asset loans only)

---

## 4. Phase 1 — Customer Onboarding

### Path A: Self-Service via App

```
1. POST /auth/signup
   Body: { name, email, contact?, password }
   → Creates INACTIVE user, sends 6-digit OTP via email
   → If contact-only (no email): user starts as FLAGGED

2. POST /auth/verify (email verification)
   Body: { email, code }
   → Redis key verify:{email} checked, then deleted
   → User status stays INACTIVE (still needs PPI)

3. POST /user/ppi/identity
   Body: { dateOfBirth, gender, maritalStatus, residencyAddress, ... }
   → Event fired, UserIdentity created, user → FLAGGED

4. POST /user/ppi/payment-method
   Body: { bankName, accountNumber, accountName, bvn }
   → Event fired, UserPaymentMethod created, user → FLAGGED

5. POST /user/ppi/payroll
   Body: { externalId, grade, step, command, organization, netPay, employeeGross }
   → Event fired, UserPayroll created, User.externalId set, user → FLAGGED

6. Admin activates: PATCH /admin/customer/:id/status
   Body: { status: "ACTIVE", reason: "Documents verified" }
   → User is now eligible for loans
```

### Path B: Admin/Marketer Onboarding

```
POST /admin/customers
Roles: ADMIN, SUPER_ADMIN, MARKETER
Body:
{
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "contact": "08012345678"
  },
  "identity": {
    "dateOfBirth": "1985-05-15",
    "gender": "Male",
    "maritalStatus": "Married",
    "residencyAddress": "12 Main Street, Lagos",
    "stateResidency": "Lagos",
    "landmarkOrBusStop": "Near GTBank",
    "nextOfKinName": "Jane Doe",
    "nextOfKinContact": "08098765432",
    "nextOfKinAddress": "12 Main Street, Lagos",
    "nextOfKinRelationship": "Spouse"
  },
  "paymentMethod": {
    "bankName": "GTBank",
    "accountNumber": "0123456789",
    "accountName": "JOHN DOE",
    "bvn": "12345678901"
  },
  "payroll": {
    "externalId": "IPPIS/001234",
    "grade": "GL-12",
    "step": 4,
    "command": "NHQ LAGOS",
    "organization": "FEDERAL CIVIL SERVICE",
    "netPay": 185000,
    "employeeGross": 250000
  },
  "loan": {
    "category": "PERSONAL",
    "cashLoan": { "amount": 500000, "tenure": 12 }
  }
}

Result:
→ User created with status ACTIVE (or FLAGGED if MARKETER)
→ All PPI records created in a single transaction
→ Login credentials emailed to customer
→ If loan included: cash loan created + auto-approved
```

Note: If a MARKETER onboards, the user starts as `FLAGGED` with reason "User onboarded by marketer. Needs admin review to be activated".

---

## 5. Phase 2 — Loan Request

### 5.1 Cash Loan Request

```
POST /user/loan
Authorization: Bearer <customer_jwt>
Body:
{
  "amount": 500000,
  "category": "PERSONAL"
}

Valid categories:
  EDUCATION, PERSONAL, BUSINESS, MEDICAL, RENT,
  TRAVEL, AGRICULTURE, UTILITIES, EMERGENCY, OTHERS, ASSET_PURCHASE

Response:
{
  "message": "Loan application submitted successfully",
  "data": { "id": "LN_abc123xyz" }
}
```

**Service logic (`requestCashLoan`):**
1. Fetch user — if FLAGGED and no admin override → throw 400
2. Fetch `INTEREST_RATE` and `MANAGEMENT_FEE_RATE` from Config — if missing → throw 400
3. Count pending loans for this user — if > 0 → throw 400 ("already have a pending loan")
4. Generate loan ID
5. Emit `user-loan-request` event (async, fire-and-forget)
6. Return `{ id }` immediately

**Event listener (`userLoanRequest`):**
1. Check if user has any `DISBURSED` loan → set `type = 'Topup'` if yes, else `'New'`
2. Create `Loan` record with status `PENDING`, the current `interestRate`, `managementFeeRate`

> Note: The `interestRate` and `managementFeeRate` are **snapshotted** at request time from Config. A rate change after submission does not retroactively affect existing pending loans.

### 5.2 Commodity (Asset) Loan Request

```
POST /user/loan/commodity
Authorization: Bearer <customer_jwt>
Body:
{
  "assetName": "Laptop"
}

Response:
{
  "message": "You have successfully requested a commodity loan for Laptop! ...",
  "data": { "id": "CL_abc123xyz" }
}
```

**Service logic:**
1. Fetch `COMMODITY_CATEGORIES` from Config (comma-separated list)
2. If `assetName` not in list → throw 400
3. If user has a pending loan → throw 400
4. Emit `user-commodity-loan-request` event
5. Creates `CommodityLoan` with `inReview: true`

No rates are captured at this stage — admin sets all financial terms when approving.

### 5.3 Modify or Delete a Pending Loan

```
PUT /user/loan/:loanId
Body: { "amount": 600000, "category": "BUSINESS" }
→ Only works if status is PENDING

DELETE /user/loan/:loanId
→ Only works if status is PENDING
→ Hard-deletes the Loan record
```

---

## 6. Phase 3 — Admin Review & Approval

### 6.1 Cash Loan Approval

```
PATCH /admin/loans/cash/:loanId/approve
Roles: ADMIN, SUPER_ADMIN
Body:
{
  "tenure": 12
}

Response:
{
  "message": "Loan approved successfully",
  "data": { "userId": "USR_abc123" }
}
```

**What happens:**
- Verifies loan is `PENDING` (throws if not)
- Updates `Loan.tenure = 12`, `Loan.status = APPROVED`

Nothing happens to the customer at this point. No notification is sent (commented out in code).

### 6.2 Cash Loan Rejection

```
PATCH /admin/loans/cash/:loanId/reject
Roles: ADMIN, SUPER_ADMIN
→ Allowed if status is PENDING or APPROVED (not DISBURSED/REPAID)
→ Sets status = REJECTED
```

### 6.3 Commodity Loan Approval

```
PATCH /admin/loans/commodity/:cLoanId/approve
Roles: ADMIN, SUPER_ADMIN
Body:
{
  "publicDetails": "Approved for Dell XPS 15 Laptop purchase",
  "privateDetails": "Invoice #INV-2025-001, Vendor: TechMart",
  "amount": 450000,
  "tenure": 10,
  "managementFeeRate": 3,
  "interestRate": 6
}
```

**What happens (via `approveCommodityLoan` event):**
1. Convert rates: `mRate = 3/100 = 0.03`, `iRate = 6/100 = 0.06`
2. Create a `Loan` record linked to the `CommodityLoan` with `status: PENDING`
3. Immediately call `approveLoan()` → sets tenure + status to `APPROVED`
4. Set `CommodityLoan.inReview = false`

The loan is auto-approved at the same time it's created. Admin disbursal is still a separate step.

---

## 7. Phase 4 — Disbursement

```
PATCH /admin/loans/cash/:loanId/disburse
Roles: SUPER_ADMIN only
Body: (none)

Response:
{
  "message": "Loan disbursed successfully",
  "data": { "userId": "USR_abc123" }
}
```

**Pre-checks:**
- Loan must exist
- Borrower must NOT be `FLAGGED`
- Loan status must be `APPROVED`

**Event `admin-disburse-loan` does:**
1. Fetch `principal`, `managementFeeRate`, `interestRate`, `tenure` from DB
2. Calculate:
   - `feeAmount = principal × managementFeeRate`
   - `disbursedAmount = principal − feeAmount`
   - `totalPayment = principal × (1 + interestRate × tenure)` ← via `getTotalPayment()`
3. Update Loan:
   - `status = DISBURSED`
   - `disbursementDate = now()`
   - `repayable = totalPayment`
4. Update Config counters:
   - `MANAGEMENT_FEE_REVENUE += feeAmount`
   - `TOTAL_DISBURSED += disbursedAmount`
   - `BALANCE_OUTSTANDING += totalPayment`
   - `TOTAL_BORROWED += totalPayment`

**Example numbers:**
```
Principal:           ₦500,000
Management fee (3%): ₦15,000
Amount disbursed:    ₦485,000  ← customer receives this
Interest rate (6%/mo × 12mo = 72%):
Total repayable:     ₦500,000 × 1.72 = ₦860,000
Monthly payment:     ₦860,000 / 12 = ₦71,666.67
```

---

## 8. Phase 5 — Monthly Repayment Processing

This is the core financial operation. It now has two explicit phases: upload one or more payroll files for an open period, then close that period once all agencies/files for the month have been uploaded.

### 8.1 Upload the Repayment Document

```
POST /admin/repayments/upload
Roles: SUPER_ADMIN
Content-Type: multipart/form-data

Body (form-data):
  file:   [Excel file .xlsx / .xls, max 10MB]
  period: "APRIL 2025"

Response:
{
  "data": null,
  "message": "Repayment has been queued for processing"
}
```

**What happens synchronously:**
1. File MIME type validated (must be `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `application/vnd.ms-excel`)
2. Buffer is hashed with SHA-256; an exact duplicate file is rejected before upload
3. Upload is rejected if `parsePeriodToDate(period) <= LAST_REPAYMENT_DATE` because that period is already closed
4. File uploaded to Supabase storage
5. Queue job `process_new_repayments` created with `{ url, period }`
6. `RepaymentUpload` audit row recorded with `fileHash`, `filename`, `uploadedBy`, and `rowCount`
7. HTTP 200 returned immediately

**Expected Excel file format:**
```
| STAFFID      | GRADE | STEP | COMMAND     | EMPLOYEEGROSS | NETPAY  | AMOUNT  | ORGANIZATION |
|--------------|-------|------|-------------|---------------|---------|---------|--------------|
| IPPIS/001234 | GL-12 | 4    | NHQ LAGOS   | 250000        | 185000  | 71667   | FEDERAL      |
| IPPIS/005678 | GL-08 | 2    | NHQ ABUJA   | 150000        | 120000  | 45000   | POLICE       |
```

Header matching is **case-insensitive** and **whitespace-stripped** (e.g. "Staff ID", "staffid", "STAFF ID" all match). The organization column is required but can be supplied as any one of `mda`, `organization`, `company`, or `sub organization`.

### 8.2 Queue Consumer Processing (`handleIPPISrepayment`)

The consumer processes the job in this order:

**Step 1 — Generate AWAITING repayments for all active loans**

```
For every Loan with status = DISBURSED:
  Skip if a Repayment for this period already exists for this loan
  
  monthlyDue = getTotalPayment(principal, rate, tenure) / (tenure + extension)
  penaltyOwed = loan.penalty - loan.penaltyRepaid
  expectedAmount = penaltyOwed + monthlyDue
  
  Create Repayment {
    status:         AWAITING,
    amount:         0,
    expectedAmount: expectedAmount,
    penaltyCharge:  penaltyOwed,
    period:         "APRIL 2025",
    periodInDT:     2025-04-01T00:00:00Z,
    userId:         loan.borrowerId,
    loanId:         loan.id
  }
```

**Step 2 — Build IPPIS → InternalUserId map**

Query `UserPayroll` for all `externalId` values found in the Excel. Returns a `Map<externalId, internalUserId>`.

**Step 3 — Process each Excel row**

For each row:
1. Parse row into `{ externalId, payroll: {grade, step, command, organization, employeeGross, netPay}, repayment: {amount, period} }`
2. Skip row if `amount === 0`
3. Look up `userId = payrollMap.get(externalId)`
4. If `userId` not found → create `MANUAL_RESOLUTION` repayment with `failureNote: "No corresponding IPPIS ID found for the given staff id: {externalId}"` → skip to next row
5. If the user already has any non-`AWAITING` `PAYROLL` repayment for this period, skip the row entirely as a duplicate payroll replay
6. Update `UserPayroll` with new payroll values from this row
7. Fetch all `PAYROLL` AWAITING repayments for `userId` in this period (ordered by `disbursementDate ASC`)
8. Walk through each loan's repayment, allocating balance greedily:
   ```
   For each AWAITING repayment (oldest loan first):
     repaidAmount = min(balance, expectedAmount)
     status       = repaidAmount == expectedAmount ? FULFILLED : PARTIAL
     overdue      = expectedAmount - repaidAmount
     newPenalty   = overdue * PENALTY_FEE_RATE
     
     Update Repayment: { repaidAmount, status, amount = totalIPPISAmount }
     Update Loan:
       repaid      += principalPaid  (from getLoanRevenue)
       penalty     += newPenalty
       penaltyRepaid += penaltyPaid  (from getLoanRevenue)
       extension   += 1              (if newPenalty > 0)
       status       = REPAID         (if totalRepaid >= totalPayable)
     
     balance -= repaidAmount
   ```
9. Update `User.repaymentRate = (totalPaid / totalExpected) * 100` cumulatively
10. If balance > 0 after all loans processed → create `MANUAL_RESOLUTION` repayment with `source = OVERFLOW`

**Step 4 — Update global config counters for applied rows**

```
TOTAL_REPAID          += totalRepaid (all periods)
BALANCE_OUTSTANDING   -= totalRepaid
INTEREST_RATE_REVENUE += totalInterestRevenue
PENALTY_FEE_REVENUE   += totalPenaltyRevenue
```

No period close happens here. Upload jobs only apply what is present in the file.

### 8.3 Close the Repayment Period

```
POST /admin/repayments/close-period
Roles: ADMIN, SUPER_ADMIN
Body:
{
  "period": "APRIL 2025"
}
```

The close-period queue job performs the old fail-sweep explicitly:

1. Fetch remaining `PAYROLL` repayments still in `AWAITING` for the period
2. Mark each one `FAILED`
3. Add `expectedAmount * PENALTY_FEE_RATE` to the loan penalty and increment `extension`
4. Top up `BALANCE_OUTSTANDING` by the total penalty added in that sweep
5. Set `LAST_REPAYMENT_DATE = parsePeriodToDate(period)`

### 8.4 Revenue Allocation (`getLoanRevenue`)

When a payment comes in, revenue is split between penalty, interest, and principal:

```typescript
// Payment priority: penalty first, then interest+principal proportionally

penaltyOwed = loan.penalty - loan.penaltyRepaid

if (penaltyOwed >= currentPayment):
  // Entire payment goes to penalty
  return { penalty: currentPayment, interest: 0, principalPaid: 0 }

balance         = currentPayment - penaltyOwed
totalInterest   = loan.repayable - loan.principal
interestRatio   = totalInterest / loan.repayable
interest        = balance * interestRatio
principalPaid   = balance  // balance is used as principal paid (interest already embedded)

return { penalty: penaltyOwed, interest, principalPaid: balance }
```

**Example — Healthy payment (₦71,667 due, ₦71,667 paid, no outstanding penalty):**
```
penaltyOwed    = 0
balance        = 71,667
totalInterest  = 860,000 - 500,000 = 360,000
interestRatio  = 360,000 / 860,000 = 0.4186
interest       = 71,667 × 0.4186 = ₦29,999
principalPaid  = 71,667

Loan.repaid   += 71,667
Loan.penalty  += 0  (no overdue)
```

**Example — Partial payment (₦71,667 due, ₦50,000 paid, no outstanding penalty):**
```
overdue     = 71,667 - 50,000 = 21,667
newPenalty  = 21,667 × penaltyRate (e.g., 0.05 = 5%) = ₦1,083

Loan.repaid    += principalPaid (from 50,000 allocated to interest + principal)
Loan.penalty   += 1,083
Loan.extension += 1
```

---

## 9. Phase 6 — Manual Resolution & Overflow

Some repayments end up in `MANUAL_RESOLUTION` status:
- **Type A (No IPPIS match):** `userId = null`, `loanId = null`, `failureNote` shows the unknown staffId
- **Type B (Overflow):** `userId = <id>`, `loanId = null`, payment exceeds all expected amounts for a user

### Resolving a No-Match Repayment (Type A)

```
PATCH /admin/repayments/:id/manual-resolution
Body:
{
  "resolutionNote": "Verified as John Doe, IPPIS/001234 is correct. Old record.",
  "userId": "USR_abc123"
}
→ Queue job: process_overflow_repayments
→ Allocates payment across user's DISBURSED loans (oldest tenure first)
```

### Resolving an Overflow Repayment (Type B)

```
PATCH /admin/repayments/:id/manual-resolution
Body:
{
  "resolutionNote": "Overpayment from March, applied to June",
  "loanId": "LN_xyz789"
}
→ Event: admin-resolve-repayment
→ Applies the repayment.amount to the specific loan
```

---

## 10. Phase 7 — Loan Liquidation (Early Payoff)

A liquidation request allows a customer to pay off their entire outstanding balance in a single payment.

### Step 1: Admin creates the request

```
POST /admin/customer/:userId/request-liquidation
Body:
{
  "amount": 650000
}
→ Creates LiquidationRequest { status: PENDING, totalAmount: 650000 }
```

### Step 2: Super Admin accepts

```
PATCH /admin/repayments/:liquidationRequestId/accept-liquidation
Roles: SUPER_ADMIN
→ Updates LiquidationRequest.status = APPROVED (pre-emptively)
→ Queues: process_liquidation_request
```

### Step 3: Queue consumer processes

```
handleLiquidationRequest:
  period = parseDateToPeriod()  ← current date's period
  allocateRepayment({
    liquidationRequestId,
    userId,
    amount: totalAmount,
    period
  })
  
  For each DISBURSED loan (ordered: tenure ASC, disbursementDate ASC, principal ASC):
    owed = (repayable + penalty) - (repaid + penaltyRepaid)
    repaymentAmount = min(balance, owed)
    
    Create Repayment {
      status:        FULFILLED,
      repaidAmount:  repaymentAmount,
      expectedAmount: repaymentAmount,
      liquidationRequestId: id
    }
    
    Update Loan: repaid += principalPaid, penaltyRepaid += penaltyPaid
    If fully repaid: Loan.status = REPAID
  
  Update LiquidationRequest: status = APPROVED, approvedAt = now()
  On any error: status = REJECTED, approvedAt = null
```

### Step 4: Or reject

```
PATCH /admin/repayments/:liquidationRequestId/reject-liquidation
Roles: SUPER_ADMIN
→ LiquidationRequest.status = REJECTED (only if status is PENDING)
```

---

## 11. Loan Financial Maths

All interest is **flat-rate** (not reducing balance):

```
getTotalPayment(principal, rate, tenure):
  = principal + (principal × rate × tenure)
  = principal × (1 + rate × tenure)

getMonthlyPayment(principal, rate, tenure, extension):
  = getTotalPayment(principal, rate, tenure) / (tenure + extension)
```

**Example:**
```
Principal:    ₦500,000
Rate:         6%/month  (stored as 0.06)
Tenure:       12 months

Total repayable = 500,000 × (1 + 0.06 × 12) = 500,000 × 1.72 = ₦860,000
Monthly payment = 860,000 / 12 = ₦71,666.67

After 3 missed payments (extension = 3):
Monthly payment = 860,000 / (12 + 3) = 860,000 / 15 = ₦57,333.33
↑ Monthly payment DECREASES as extensions accumulate
```

---

## 12. Real-World End-to-End Example

### Scenario: Civil servant takes a 12-month personal loan of ₦500,000

---

**Day 1 — Admin onboards customer**
```http
POST /admin/customers
{
  "user": { "name": "Emeka Okafor", "email": "emeka@gov.ng", "contact": "08012345678" },
  "identity": { "dateOfBirth": "1980-01-15", ... },
  "paymentMethod": { "bankName": "Zenith Bank", "accountNumber": "2012345678", "bvn": "12345678901", "accountName": "EMEKA OKAFOR" },
  "payroll": { "externalId": "IPPIS/007890", "grade": "GL-14", "step": 5, "command": "LAGOS STATE SECRETARIAT", "organization": "LAGOS STATE GOVERNMENT", "netPay": 280000, "employeeGross": 350000 }
}
→ User created, ACTIVE. Welcome email sent with temp password.
```

**Day 3 — Emeka requests a loan**
```http
POST /user/loan
Authorization: Bearer <emeka_jwt>
{
  "amount": 500000,
  "category": "PERSONAL"
}
→ Response: { "data": { "id": "LN_emeka001" } }
→ DB: Loan created { principal: 500000, interestRate: 0.06, managementFeeRate: 0.03, status: PENDING, type: New }
```

**Day 5 — Admin reviews and approves**
```http
PATCH /admin/loans/cash/LN_emeka001/approve
{
  "tenure": 12
}
→ DB: Loan { tenure: 12, status: APPROVED }
```

**Day 7 — Super Admin disburses**
```http
PATCH /admin/loans/cash/LN_emeka001/disburse
(no body)
→ Event fired: admin-disburse-loan
→ DB: Loan {
    status: DISBURSED,
    disbursementDate: "2025-04-07",
    repayable: 860000     ← 500,000 × (1 + 0.06×12)
  }
→ Config updates:
    MANAGEMENT_FEE_REVENUE += 15,000   (500,000 × 0.03)
    TOTAL_DISBURSED        += 485,000  (500,000 − 15,000)
    BALANCE_OUTSTANDING    += 860,000
    TOTAL_BORROWED         += 860,000

→ Emeka physically receives: ₦485,000
```

**Month 1 — April Repayment Uploaded (Emeka pays in full)**
```http
POST /admin/repayments/upload
form-data:
  file:   april_ippis_deductions.xlsx
  period: "APRIL 2025"

Excel row for Emeka:
  STAFFID=IPPIS/007890, EMPLOYEEGROSS=350000, NETPAY=280000, AMOUNT=71667
```

Queue processes:
```
1. generateRepaymentsForActiveLoans("APRIL 2025"):
   monthlyDue  = 860,000 / 12 = 71,666.67
   penaltyOwed = 0 (first month)
   
   Creates Repayment {
     status: AWAITING, expectedAmount: 71,666.67, loanId: LN_emeka001
   }

2. Row IPPIS/007890 → userId = USR_emeka
   amount = 71,667

3. applyRepayment:
   repaidAmount = min(71,667, 71,666.67) = 71,666.67
   status       = FULFILLED
   overdue      = 71,666.67 - 71,666.67 = 0
   newPenalty   = 0 × rate = 0
   
   getLoanRevenue(71,666.67, loan):
     penaltyOwed    = 0
     balance        = 71,666.67
     interestRatio  = (860,000 - 500,000) / 860,000 = 0.4186
     interest       = 71,666.67 × 0.4186 = 29,999.10
     principalPaid  = 71,666.67 − 29,999.10 = 41,667.57
   
   Loan.repaid += 41,667.57
   Loan.extension += 0 (penalty=0)
   
   User.repaymentRate = (71,666.67 / 71,666.67) × 100 = 100%

Config:
  TOTAL_REPAID          += 71,666.67
  BALANCE_OUTSTANDING   -= 71,666.67
  INTEREST_RATE_REVENUE += 29,999.10
```

**Month 3 — March Repayment — Emeka misses payment entirely**
```
Queue row: IPPIS/007890 not found in Excel
→ markAwaitingRepaymentsAsFailed("MARCH 2025"):

Loan.penalty   += expectedAmount × PENALTY_FEE_RATE
                = 71,666.67 × 0.05 = ₦3,583.33
Loan.extension += 1  (extension now = 1)

Next month's expected:
  monthlyDue  = 860,000 / (12 + 1) = 66,153.85  ← went DOWN
  penaltyOwed = 3,583.33
  expectedAmount = 66,153.85 + 3,583.33 = ₦69,737.18

User.repaymentRate stays at previous value (not updated)
```

**Month 4 — Emeka pays April (partial: pays 60,000 but 69,737 due)**
```
applyRepayment(amount=60,000):
  repaidAmount = 60,000 (partial)
  overdue      = 69,737.18 - 60,000 = 9,737.18
  newPenalty   = 9,737.18 × 0.05 = ₦486.86
  
  Loan.penalty   += 486.86
  Loan.extension += 1  (extension now = 2)
  
  User.repaymentRate = (60,000 / 69,737.18) × 100 = 86%
```

**Completion — Full repayment or liquidation**

After 12+ months with no extension, or via liquidation:
```
totalRepaid = loan.repaid + loan.penaltyRepaid >= loan.repayable + loan.penalty
→ Loan.status = REPAID
```

---

## 13. Commodity (Asset) Loan Flow

```
1. Customer: POST /user/loan/commodity
   Body: { "assetName": "Generator" }
   → CommodityLoan { inReview: true, name: "Generator" }

2. Admin: GET /admin/loans/commodity  ← reviews pending commodity loans

3. Admin: PATCH /admin/loans/commodity/:cLoanId/approve
   Body: {
     "publicDetails": "Sumec 10KVA Generator approved",
     "privateDetails": "Purchased from PowerPro Ltd, invoice #INV-2025-007",
     "amount": 350000,
     "tenure": 10,
     "managementFeeRate": 3,
     "interestRate": 5
   }
   
   Event: admin-approve-commodity-loan
   → Creates Loan { principal: 350000, interestRate: 0.05, managementFeeRate: 0.03, tenure: 10, status: APPROVED }
   → Links CommodityLoan.loanId = new loanId
   → Sets CommodityLoan.inReview = false
   → Auto-calls approveLoan() → Loan.status = APPROVED

4. Super Admin: PATCH /admin/loans/cash/:loanId/disburse
   → Same disbursement flow as cash loan

5. Customer can see public details:
   GET /user/loan/commodity/:cLoanId
   → Returns { name, inReview, details: publicDetails, ... }
   
   Customer CANNOT see privateDetails (admin-only)
```

**Rejecting a commodity loan:**
```
PATCH /admin/loans/commodity/:cLoanId/reject
→ CommodityLoan.inReview = false
→ Creates a zero-principal REJECTED Loan record (for audit trail)
```

---

## 14. Topup Loan Flow

A Topup loan is an additional loan taken while the customer still has an active DISBURSED loan.

```
Conditions for topup:
- Customer must have at least one DISBURSED loan
- Customer must NOT already have a PENDING loan

Loan type is automatically set to 'Topup' in the event listener when a DISBURSED loan exists.

Admin topup via:
POST /admin/customer/:userId/loan-topup
Body:
{
  "category": "EDUCATION",
  "cashLoan": { "amount": 200000, "tenure": 6 }
}

Flows through the same cash loan event → approval → disbursement pipeline.
```

During repayment processing, topup loans are treated as separate loans. Repayment is allocated by `disbursementDate ASC` (oldest first), so the original loan gets paid off before the topup.

---

## 15. Global Config Counters

| Key | Type | Description | Changed when |
|-----|------|-------------|-------------|
| `INTEREST_RATE` | Decimal | Monthly flat interest rate | Admin sets via `/admin/config` |
| `MANAGEMENT_FEE_RATE` | Decimal | Origination fee | Admin sets via `/admin/config` |
| `PENALTY_FEE_RATE` | Decimal | Monthly penalty rate | Admin sets via `/admin/config` |
| `TOTAL_DISBURSED` | Number | Sum of `principal - managementFee` | On disbursal |
| `TOTAL_BORROWED` | Number | Sum of `repayable` amounts | On disbursal |
| `TOTAL_REPAID` | Number | Cumulative repayments | On each repayment batch |
| `BALANCE_OUTSTANDING` | Number | Running outstanding balance | +On disbursal, -On repayment |
| `INTEREST_RATE_REVENUE` | Number | Cumulative interest earned | On each repayment batch |
| `MANAGEMENT_FEE_REVENUE` | Number | Cumulative fees earned | On disbursal |
| `PENALTY_FEE_REVENUE` | Number | Cumulative penalties collected | On each repayment batch |
| `LAST_REPAYMENT_DATE` | Date | Last closed repayment period date | After explicit period close |
| `COMMODITY_CATEGORIES` | String | Comma-separated asset names | Admin-managed |

---

## 16. Event & Queue Architecture

### Event Names (`src/queue/events/events.ts`)

| Event constant | String value | Fired by | Handled by |
|---|---|---|---|
| `Auth.userSignUp` | `auth-user-signup` | AuthService.signup | AuthService (events) |
| `UserEvents.userLoanRequest` | `user-loan-request` | LoanService.requestCashLoan | UserService (events) |
| `UserEvents.userLoanUpdate` | `user-loan-update` | LoanService.updateLoan | UserService (events) |
| `UserEvents.userLoanDelete` | `user-loan-delete` | LoanService.deleteLoan | UserService (events) |
| `UserEvents.userCommodityLoanRequest` | `user-commodity-loan-request` | LoanService.requestAssetLoan | UserService (events) |
| `AdminEvents.disburseLoan` | `admin-disburse-loan` | CashLoanService.disburseLoan | AdminService (events) |
| `AdminEvents.approveCommodityLoan` | `admin-approve-commodity-loan` | CommodityLoanService.approveCommodityLoan | AdminService (events) |
| `AdminEvents.adminResolveRepayment` | `admin-resolve-manual-repayment` | RepaymentsService.manuallyResolveRepayment | AdminService (events) |
| `AdminEvents.onboardCustomer` | `onboard-customer` | CustomerService.onboardCustomer | AdminService (events) |
| `AdminEvents.loanTopup` | `admin-loan-topup` | CustomerService.loanTopup | AdminService (events) |

### Queue Jobs

| Queue | Job name | Triggered by | Consumer |
|---|---|---|---|
| `repayments` | `process_new_repayments` | `QueueProducer.queueRepayments()` | `RepaymentsConsumer` |
| `repayments` | `process_overflow_repayments` | `QueueProducer.overflowRepayment()` | `RepaymentsConsumer` |
| `repayments` | `process_liquidation_request` | `QueueProducer.liquidationRequest()` | `RepaymentsConsumer` |
| `reports` | `schedule_variation` | `QueueProducer.generateReport()` | `GenerateReports` |
| `reports` | `customer_report` | `QueueProducer.generateCustomerLoanReport()` | `GenerateReports` |
| `services` | `onboard_existing_customers` | `QueueProducer.addExistingCustomers()` | `ServicesConsumer` |
| `maintenance` | `supabase_ping` | Module init (every 3h) | `MaintenanceConsumer` |
| `maintenance` | `report` | Module init (last day of month, 23:45) | `MaintenanceConsumer` |

---

## 17. Extension Behaviour & Default Interest — Design Note

### How Extensions Work in MicroBuilt

When a repayment is missed or partial, the system adds `extension += 1` to the loan. The total repayable amount is **fixed at disbursement** and never changes:

```
getTotalPayment(principal, rate, tenure) = principal × (1 + rate × tenure)
getMonthlyPayment(...) = getTotalPayment(...) / (tenure + extension)
```

This means extensions **lower** the monthly payment rather than adding new interest. The only financial cost of defaulting is the **penalty** (`overdue × penaltyRate`).

### Is This Standard?

It depends on the loan type:

| System Type | What Happens on Extension / Default |
|---|---|
| **Flat-rate / add-on interest** (MicroBuilt, Nigerian/African microfinance, payroll-deduction schemes) | Total interest is fixed at origination. Extension just re-amortizes the remaining balance over more months. Penalty is the only default cost. |
| **Reducing-balance / amortizing** (commercial banks, most Western consumer loans) | Interest accrues on the outstanding principal monthly. An extension means more interest accrues — total cost grows with time. |
| **Revolving credit / payday loans** | Interest compounds on the unpaid balance; defaulting can significantly escalate the total owed. |

MicroBuilt uses a **flat-rate (add-on) interest model**, which is standard for salary-deduction and IPPIS-based government employee lending in Nigeria. Fixing total interest at disbursement and using penalties as the sole default cost is consistent with how these schemes typically operate — the lender's yield is protected by the penalty fee, and the borrower's total obligation does not compound.

### Potential Design Consideration

Because extensions lower the monthly due, a borrower making consistent partial payments will see their monthly obligation decrease over time while penalty charges accumulate separately. Depending on the `PENALTY_FEE_RATE`, there is a scenario where repeated partial payments are financially advantageous to the borrower compared to full repayment. This is worth validating against product intent — if the penalty rate is not set high enough relative to the interest rate, it may not serve as a sufficient deterrent against strategic underpayment.

*End of Document 1*
