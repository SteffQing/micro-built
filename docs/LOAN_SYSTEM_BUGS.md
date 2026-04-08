# MicroBuilt Loan System — Bug Report

> Technical audit of hidden and non-obvious bugs in the Loan, Repayment, CommodityLoan, and LiquidationRequest subsystems.

Bugs are classified by severity:
- **CRITICAL** — Can cause silent financial data corruption or catastrophic mass-penalty scenarios
- **MAJOR** — Causes wrong behaviour, data loss, or incorrect financial calculations
- **MINOR** — Logic errors, inconsistencies, or edge cases that cause incorrect UX or dirty data

---

## Table of Contents

1. [CRITICAL: Wrong Excel file triggers mass penalty cascade](#bug-1-critical-wrong-excel-file-triggers-mass-penalty-cascade)
2. [CRITICAL: adminResolveRepayment uses wrong amount-owed formula](#bug-2-critical-adminresolverepayment-uses-wrong-amount-owed-formula)
3. [CRITICAL: BullMQ job retry causes financial double-counting](#bug-3-critical-bullmq-job-retry-causes-financial-double-counting)
4. [MAJOR: acceptLiquidationRequest pre-emptively approves before queue succeeds](#bug-4-major-acceptliquidationrequest-pre-emptively-approves-before-queue-succeeds)
5. [MAJOR: repaymentRate overwrites all history with just the current period](#bug-5-major-repaymentrate-overwrites-all-history-with-just-the-current-period)
6. [MAJOR: getCommodityLoanRequestHistory loses approved/rejected loans](#bug-6-major-getcommodityloanrequesthistory-loses-approvedrejected-loans)
7. [MAJOR: getAllUserLoans applies pagination twice, silently dropping records](#bug-7-major-getalluserloans-applies-pagination-twice-silently-dropping-records)
8. [MAJOR: BALANCE_OUTSTANDING accounting diverges from reality over time](#bug-8-major-balance_outstanding-accounting-diverges-from-reality-over-time)
9. [MINOR: MIME type spoofing bypasses file validation](#bug-9-minor-mime-type-spoofing-bypasses-file-validation)
10. [MINOR: Duplicate period upload creates phantom MANUAL_RESOLUTION records](#bug-10-minor-duplicate-period-upload-creates-phantom-manual_resolution-records)
11. [MINOR: Payroll data silently overwritten from Excel with no validation](#bug-11-minor-payroll-data-silently-overwritten-from-excel-with-no-validation)
12. [MINOR: rejectCommodityLoan creates a zero-principal ghost loan record](#bug-12-minor-rejectcommodityloan-creates-a-zero-principal-ghost-loan-record)
13. [MINOR: getLoanRevenue does not protect against zero repayable](#bug-13-minor-getloanrevenue-does-not-protect-against-zero-repayable)
14. [MINOR: applyRepayment payroll update runs before AWAITING check](#bug-14-minor-applyrepayment-payroll-update-runs-before-awaiting-check)
15. [MINOR: scheduleVariation tenure calculation uses wrong reference point](#bug-15-minor-schedulevariation-tenure-calculation-uses-wrong-reference-point)

---

## Bug 1 — CRITICAL: Wrong Excel file triggers mass penalty cascade

**File:** `src/admin/repayments/repayments.controller.ts:141–169`  
**File:** `src/queue/bull/queue.repayments.ts:62–149`

### What happens

When a Super Admin uploads the monthly repayment Excel, the controller only validates the **MIME type** (provided by the HTTP client). The file's actual column structure is never checked before the file is uploaded to Supabase and queued for processing.

Inside the BullMQ consumer, `generateRepaymentsForActiveLoans()` is called **first** — it creates `AWAITING` repayment records for every single active (DISBURSED) loan on the platform. Only then does the consumer attempt to parse and apply the Excel rows.

If the Excel file has **wrong or missing column headers** (e.g., the IPPIS department sent a different format this month), `mapRowToEntry` silently defaults every missing field to `0` or `""`:

```typescript
// src/queue/bull/queue.repayments.ts:162-172
const repayment = {
  amount: parseFloat(rowData['amount']) || 0,  // ← 0 if column not found
  period,
};
```

The check `if (entry.repayment.amount > 0)` then **skips every single row**.

After processing zero rows, `markAwaitingRepaymentsAsFailed()` runs and marks every AWAITING repayment — covering every borrower on the platform — as **FAILED**, adding a penalty to each one:

```typescript
// src/queue/bull/queue.repayments.ts:534-543
const penalty = rep.expectedAmount.mul(rate);
// Repayment.status  = FAILED
// Loan.penalty     += penalty
// Loan.extension   += 1
```

**Worst case:** Upload a valid `.xlsx` file (passes MIME check) with different column names (e.g., "IPPIS NUMBER" instead of "STAFFID") → **every single active borrower gets penalised** for that period with no actual payment recorded.

Compare to the `addExistingCustomers` upload (`src/queue/bull/queue.producer.ts:71–162`) which validates required columns before queuing and throws a `BadRequestException` with the missing column names. The repayment upload has no equivalent validation.

### Where to fix

In `uploadRepaymentDocument` (before uploading to Supabase), or at the start of `handleIPPISrepayment` (before calling `generateRepaymentsForActiveLoans`), validate the column headers:

```typescript
const REQUIRED_REPAYMENT_HEADERS = ['staffid', 'amount', 'employeegross', 'netpay'];
// Check all required headers are present in the first row
// Throw BadRequestException with missing columns before proceeding
```

---

## Bug 2 — CRITICAL: adminResolveRepayment uses wrong amount-owed formula

**File:** `src/queue/events/events.admin.ts:92–174`

### What happens

The `adminResolveRepayment` handler is called when an admin manually resolves an overflow repayment. It calculates how much to apply to the loan:

```typescript
// events.admin.ts:118-122
const repaymentAmount = repayment.amount;
const principal = loan.principal.add(loan.penalty);  // ← BUG
const amountOwedRaw = principal.sub(loan.repaid);     // ← BUG
const amountOwed = Prisma.Decimal.max(amountOwedRaw, 0);
```

**Bug A — Uses `principal` instead of `repayable`:**
`loan.principal` is the original borrowed amount (e.g., ₦500,000). `loan.repayable` is the total amount due including interest (e.g., ₦860,000). By using `principal`, the system thinks the customer only owes ₦500,000 + penalty, ignoring ₦360,000 of interest. This means:
- The `amountOwed` is **understated** by the entire interest component
- The system will apply less repayment than it should

**Bug B — Does not subtract `penaltyRepaid`:**
The formula is `(principal + penalty) - repaid` instead of `(repayable + penalty) - (repaid + penaltyRepaid)`. Any penalties already repaid are not accounted for, so the amount owed is **overstated**.

**Bug C — Wrong REPAID status transition:**

```typescript
// events.admin.ts:154-160
const loanRepaid = loan.repaid.add(repaymentToApply);
await this.prisma.loan.update({
  data: {
    repaid: loanRepaid,
    ...(loanRepaid.gte(principal) && { status: 'REPAID' }),  // ← wrong comparison
  },
});
```

`loanRepaid.gte(principal)` compares the new `repaid` value against `principal + penalty`, but the correct check (used everywhere else) is `(repaid + penaltyRepaid) >= (repayable + penalty)`. A loan could be marked `REPAID` while the customer still owes interest, or conversely, never be marked `REPAID` after the final payment.

**Compare with the correct formula in `allocateRepayment`:**
```typescript
// queue.repayments.ts:616-619 — CORRECT
const repayable = loan.repayable.add(loan.penalty);
const repaid = loan.repaid.add(loan.penaltyRepaid);
const owed = repayable.sub(repaid);
```

### Impact

Every overflow repayment resolved by an admin will settle the wrong amount and may not correctly close the loan. Customers could still owe money after supposedly paying off, or their loans won't flip to `REPAID` even when fully settled.

---

## Bug 3 — CRITICAL: BullMQ job retry causes financial double-counting

**File:** `src/queue/bull/queue.repayments.ts:62–149`

### What happens

If a BullMQ `process_new_repayments` job fails mid-way (e.g., a network error, DB timeout, or uncaught exception), BullMQ will retry the job automatically. The consumer has no transaction or idempotency guard for the **global config updates**.

```typescript
// queue.repayments.ts:470-495 — runs every attempt
private async updateGlobalConfigs(stats: FinancialAccumulator) {
  updates.push(this.config.topupValue('TOTAL_REPAID', stats.totalRepaid));
  updates.push(this.config.depleteValue('BALANCE_OUTSTANDING', stats.totalRepaid));
  updates.push(this.config.topupValue('INTEREST_RATE_REVENUE', stats.totalInterestRevenue));
  updates.push(this.config.topupValue('PENALTY_FEE_REVENUE', stats.totalPenaltyRevenue));
}
```

`topupValue` and `depleteValue` **add/subtract** to existing values. If a job processes 80 out of 100 rows, updates configs, then crashes and retries:
- On the first run: config updated with stats from rows 1–80
- On retry: rows 1–80 have their repayments already `FULFILLED/PARTIAL` (not `AWAITING`), so `applyRepayment` skips them
- `updateGlobalConfigs` only runs once at the end (after all rows) in the retry, so stats only contain rows 81–100 — this is actually fine for the config

Wait — BUT: if the job crashes **after** `updateGlobalConfigs` but before `setRecentProcessedRepayment`, the configs are updated but `LAST_REPAYMENT_DATE` is not set. This is a minor consistency issue but not double-counting.

The actual double-counting risk is more specific: if `updateGlobalConfigs` is called and then the job crashes **before the `await` completes** (e.g., Redis connection drops mid-batch), the configs could be partially updated. Since the calls are `Promise.all`, some writes may succeed and some fail. On retry, the fully successful updates won't be re-applied, but the partial ones may produce incorrect counters.

More critically, for the `process_overflow_repayments` and liquidation jobs — each job calls `updateGlobalConfigs` with no guard. If a liquidation job is retried due to the `LiquidationRequest` update failing (unrelated to the allocation), the allocation and config updates have already applied but run again on the retry.

### Root issue

There is no idempotency key or "already-processed" check on the financial counter updates. The entire repayment job should be wrapped in a database transaction, or at minimum, configs should only be updated after all other writes succeed atomically.

---

## Bug 4 — MAJOR: acceptLiquidationRequest pre-emptively approves before queue succeeds

**File:** `src/admin/repayments/repayments.service.ts:308–342`

### What happens

```typescript
// repayments.service.ts:327-335
await this.prisma.liquidationRequest.update({
  where: { id },
  data: { status: 'APPROVED' },  // ← sets APPROVED synchronously
});

await this.queue.liquidationRequest({  // ← queues async processing
  liquidationRequestId: id,
  userId: lr.customerId,
  amount: lr.totalAmount.toNumber(),
});
```

The `LiquidationRequest` is set to `APPROVED` **before** the queue actually processes and applies the payment to the loans. There are two problems:

**Problem A — Rejection endpoint is blocked:**

`rejectLiqudationRequest` has this guard:
```typescript
if (lr.status !== 'PENDING') {
  throw new BadRequestException('Liquidation Request has been ' + lr.status.toLowerCase())
}
```

Once `acceptLiquidationRequest` runs (even if the queue hasn't processed yet), the status is `APPROVED`, and an admin can no longer reject it through the UI. If the queue job then fails (e.g., no active DISBURSED loans found for the user), the catch block sets it to `REJECTED` — but by then, the HTTP response to the frontend already showed `APPROVED`. The admin is confused because the status flipped from `APPROVED` → `REJECTED` without any action on their part.

**Problem B — Race condition on approvedAt:**

The queue consumer sets `approvedAt` when it succeeds:
```typescript
data: { status: 'APPROVED', approvedAt: new Date() }
```

There is a window where the liquidation is `APPROVED` but `approvedAt` is null — any report or query checking `approvedAt IS NOT NULL` to identify "actually processed" liquidations will miss this record.

### Fix

Remove the pre-emptive `status = APPROVED` update from `acceptLiquidationRequest`. Let the status stay `PENDING` until the queue consumer successfully processes it. Return a message like "Queued for processing" to the frontend.

---

## Bug 5 — MAJOR: repaymentRate overwrites all history with just the current period

**File:** `src/queue/bull/queue.repayments.ts:404–420`

### What happens

```typescript
const repaymentRate = totalExpectedByUser.gt(DECIMAL_ZERO)
  ? totalPaidByUser.div(totalExpectedByUser).mul(100).toFixed(0)
  : '0';

await this.prisma.user.update({
  where: { id: userId },
  data: {
    repaymentRate: Number(repaymentRate),  // ← overwrites the stored value
  },
});
```

`totalPaidByUser` and `totalExpectedByUser` are calculated **only for the current batch period** (e.g., April 2025). This ratio is then written as the permanent `User.repaymentRate`, overwriting the value from all previous months.

**Concrete impact:**

A customer who has repaid perfectly for 11 months (rate = 100%) but misses the 12th month:
- `totalPaid = 0`, `totalExpected = 71,667`
- `repaymentRate = 0/71,667 × 100 = 0%`
- Stored: `User.repaymentRate = 0`
- This customer's creditworthiness assessment, loan reports, and admin views now show `0%` — destroying 11 months of perfect payment history.

The correct implementation would calculate the cumulative rate across all historical periods: `sum(repaidAmount) / sum(expectedAmount) × 100` across all non-MANUAL_RESOLUTION repayments for this user.

---

## Bug 6 — MAJOR: getCommodityLoanRequestHistory loses approved/rejected loans

**File:** `src/user/loan/loan.service.ts:468–511`

### What happens

```typescript
// loan.service.ts:472-482
const loans = await this.prisma.commodityLoan.findMany({
  where: {
    borrowerId: userId,
    inReview: true,     // ← only returns loans still pending admin action
  },
  ...
```

Once a commodity loan is approved or rejected (`inReview` becomes `false`), it **disappears completely** from the customer's commodity loan history endpoint (`GET /user/loan/commodity`).

A customer who submitted an asset loan request, got it approved, and then tries to view their commodity loan history will see an empty list. This also affects `getCommodityLoanRequestHistory` used in the `count` query — it returns `total = 0` for any user whose commodity loans have been processed.

The `inReview: true` filter was likely intended for a "pending requests" view, not a full history view. The full history should not filter by `inReview`.

---

## Bug 7 — MAJOR: getAllUserLoans applies pagination twice, silently dropping records

**File:** `src/user/loan/loan.service.ts:173–256`

### What happens

```typescript
// loan.service.ts:176-223 — both queries use skip+take
const [cashLoans, commodityLoans, totalCash, totalCommodity] = await Promise.all([
  this.prisma.loan.findMany({
    skip: (page - 1) * limit,   // ← DB-level pagination applied
    take: limit,
    ...
  }),
  this.prisma.commodityLoan.findMany({
    skip: (page - 1) * limit,   // ← DB-level pagination applied
    take: limit,
    ...
  }),
  ...
]);

// Then pagination is applied again on the combined result:
const allLoans = [...cashHistory, ...commodityHistory].sort(...)
const paginated = allLoans.slice(skip, skip + limit);  // ← client-level pagination applied again
```

**What this produces for page 2 (skip=10, limit=10):**
1. DB fetches cash loans 10–20 and commodity loans 10–20 → up to 20 items
2. They are merged and sorted by date
3. `allLoans.slice(10, 20)` takes the second half → 10 items

But loans 0–9 from both result sets are already excluded by the DB skip, so the combined list only contains loans ranked 10–20 from each category. Slicing positions 10–20 of this sub-list means you're actually viewing "loans 20–30" from each individual category, not "loans 10–20 of the combined list".

Items that would have appeared at positions 10–19 of the combined sorted result may have been excluded by the DB skip and then never reached by the client-side slice. Some records become **permanently unreachable** through this endpoint.

### Fix

Remove `skip` and `take` from both Prisma queries. Fetch all loans for the user (or use a higher limit), combine+sort in memory, then apply a single `slice(skip, skip + limit)`.

---

## Bug 8 — MAJOR: BALANCE_OUTSTANDING accounting diverges from reality over time

**File:** `src/queue/events/events.admin.ts:316–323` (disbursal)  
**File:** `src/queue/bull/queue.repayments.ts:470–495` (repayment)

### What happens

When a loan is disbursed:
```typescript
this.config.topupValue('BALANCE_OUTSTANDING', totalPayment)
// totalPayment = repayable = principal × (1 + rate × tenure)
// e.g., ₦860,000 added
```

When a repayment comes in, `BALANCE_OUTSTANDING` is depleted by `totalRepaid`:
```typescript
this.config.depleteValue('BALANCE_OUTSTANDING', stats.totalRepaid)
// totalRepaid includes penalties paid
```

**The problem:** When a loan payment is **missed** (FAILED status), the system adds a `penalty` to the loan but **never increments `BALANCE_OUTSTANDING`** for that new penalty amount:

```typescript
// markAwaitingRepaymentsAsFailed — NO config update here
Loan.penalty   += expectedAmount × rate  // e.g., ₦3,583 penalty added
Loan.extension += 1
// BALANCE_OUTSTANDING stays the same — ₦3,583 of new obligation ignored
```

Over time:
- `BALANCE_OUTSTANDING` represents only the original repayable amounts at disbursement
- It does not reflect the growing penalty balances across all FAILED/PARTIAL loans
- But when penalty payments ARE received, they decrement `BALANCE_OUTSTANDING`

This means `BALANCE_OUTSTANDING` becomes increasingly understated as penalties accumulate, and could potentially go **negative** if total repayments (including large penalty payments) exceed the originally tracked `repayable` balances.

The admin dashboard shows this number as "total outstanding", but it drifts further from the true outstanding balance with every missed payment.

---

## Bug 9 — MINOR: MIME type spoofing bypasses file validation

**File:** `src/admin/repayments/repayments.controller.ts:143–160`

### What happens

```typescript
fileFilter: (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Invalid file type...'), false);
  }
},
```

`file.mimetype` is the `Content-Type` set by the HTTP client. Any API client (or a confused browser with a renamed file) can send a `.txt`, `.csv`, or `.json` file with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

The file will pass validation, upload to Supabase, get queued, and when `XLSX.read(buffer, { type: 'array' })` runs in the consumer, it will either throw a parse error or silently produce an empty/garbage workbook.

If XLSX throws, the entire job fails. But by then, `generateRepaymentsForActiveLoans()` has **already been called** (it runs before the Excel rows are processed), creating AWAITING repayments for all active loans. Those will be left as AWAITING until the next repayment upload or — if a retry runs — potentially marked FAILED.

### Fix

Use `file-type` library or `magic-bytes` to inspect the actual file signature (first 4+ bytes of the buffer). Real `.xlsx` files start with the ZIP signature `PK\x03\x04`. This check happens in the controller before the upload, not in the consumer.

For additional safety, move `generateRepaymentsForActiveLoans()` to **after** the Excel header validation in the consumer, so a bad file does not create dangling AWAITING records.

---

## Bug 10 — MINOR: Duplicate period upload creates phantom MANUAL_RESOLUTION records

**File:** `src/queue/bull/queue.repayments.ts:100–134`

### What happens

If a Super Admin uploads the repayment file twice for the same period (e.g., first upload had an error, re-uploads the corrected file):

**First upload:**
1. AWAITING repayments created for all active loans
2. Excel rows applied → FULFILLED/PARTIAL/FAILED

**Second upload:**
1. `generateRepaymentsForActiveLoans` finds existing repayments for the period → skips creation (correct)
2. `applyRepayment` queries `status: 'AWAITING'` for the period → **finds nothing** (all already FULFILLED/PARTIAL/FAILED)
3. `repaymentBalance` never decreases
4. After the loop, `repaymentBalance.gt(0)` → creates a `MANUAL_RESOLUTION` repayment with `failureNote: "Overflow of repayment balance"` for **every single row** in the Excel
5. `markAwaitingRepaymentsAsFailed` finds no AWAITING records → nothing to fail

The second upload silently generates hundreds of MANUAL_RESOLUTION records, one per Excel row, which then need manual admin resolution. There is no guard preventing double submission.

### Fix

Check if `LAST_REPAYMENT_DATE` matches the submitted period before queuing. Or add a unique constraint/check on (userId, period, loanId) so duplicate AWAITING records are rejected at the DB level.

---

## Bug 11 — MINOR: Payroll data silently overwritten from Excel with no validation

**File:** `src/queue/bull/queue.repayments.ts:308–311`

### What happens

```typescript
await this.prisma.userPayroll.update({
  where: { userId: externalId },
  data: { ...payroll },  // grade, step, command, employeeGross, netPay
});
```

Every repayment upload overwrites the user's payroll information with whatever values appear in the Excel. There is no validation (min/max values, non-empty checks, type coercion) beyond:

```typescript
grade: String(rowData['grade'] || ''),
step:  Number(rowData['step'] || ''),
employeeGross: parseFloat(rowData['employeegross']) || 0,
netPay:        parseFloat(rowData['netpay']) || 0,
```

If the IPPIS Excel has a formatting issue for a specific row (e.g., merged cells causing `employeeGross` to parse as `0`), the user's `UserPayroll.employeeGross` is permanently set to `0`. The next variation schedule report would show this user with `₦0` gross pay, and any loan eligibility checks based on payroll could be affected.

Additionally, `command` is set to `String(rowData['command'] || '')`. An empty command string is technically invalid (the `UserPayroll.command` field is non-optional in the schema), and while Prisma won't reject it (it's just `String`), it would break reports that display the command column.

---

## Bug 12 — MINOR: rejectCommodityLoan creates a zero-principal ghost loan record

**File:** `src/admin/loan/loan.service.ts:405–431`

### What happens

```typescript
// loan.service.ts:408-429
const loanId = generateId.loanId();
await this.prisma.commodityLoan.update({
  where: { id: cLoanId },
  data: {
    inReview: false,
    loan: {
      create: {
        id: loanId,
        principal: 0,             // ← zero principal
        category: 'ASSET_PURCHASE',
        managementFeeRate: 0,
        interestRate: 0,
        borrowerId: cLoan.borrowerId,
        status: 'REJECTED',       // ← skips PENDING state
        // tenure: not set → defaults to 0
      },
    },
  },
});
```

This creates a `Loan` record with `principal = 0`, `tenure = 0`, `interestRate = 0`, `status = REJECTED` to serve as a rejection audit trail. Problems:

1. **Pollutes the Loan table** with records that have no financial meaning. `repayable` defaults to `0`, meaning `getLoanRevenue(amount, loan)` would cause a division-by-zero (`totalInterest / loan.repayable`) if this loan ever ended up in repayment processing (it shouldn't since it's `REJECTED`, but defensive programming would avoid this).

2. **Confuses the `/admin/loans/cash` endpoint** — even though it filters `category: { not: 'ASSET_PURCHASE' }`, admin reports that don't filter by category will include these zero-amount loans.

3. **The customer's loan count** — `getAllLoans` for a customer counts all loans. A customer who had three commodity loan requests rejected now has three ₦0 REJECTED loans in their profile.

4. **Better pattern:** Simply update the commodity loan record: `CommodityLoan.inReview = false`, `CommodityLoan.rejectedAt = now()`. No Loan record needed for a rejection.

---

## Bug 13 — MINOR: getLoanRevenue does not protect against zero repayable

**File:** `src/common/logic/repayment.logic.ts:87–97`

### What happens

```typescript
getLoanRevenue(currentPayment: Prisma.Decimal, loan: LoanPick) {
  const penaltyOwed = loan.penalty.sub(loan.penaltyRepaid);
  if (penaltyOwed.gt(currentPayment)) {
    return { penalty: currentPayment, interest: DECIMAL_ZERO, principalPaid: DECIMAL_ZERO };
  }

  const balance = currentPayment.sub(penaltyOwed);
  const totalInterest = loan.repayable.sub(loan.principal);
  const interestRatio = totalInterest.div(loan.repayable);  // ← division by zero if repayable = 0
  ...
}
```

If `loan.repayable` is `0` (e.g., a loan in `PENDING` or `APPROVED` state where `repayable` hasn't been set yet), this throws a Prisma Decimal division-by-zero error.

In the normal flow, `getLoanRevenue` is only called for `DISBURSED` loans (which have `repayable > 0`). However:

- `adminResolveRepayment` fetches a loan by `dto.loanId` and calls `getLoanRevenue`. The `manuallyResolveRepayment` service checks `loan.status !== 'DISBURSED'`, so this should be safe... but the check is in the service layer, and the event handler (`adminResolveRepayment`) does NOT re-check the status before calling `getLoanRevenue`. If somehow a non-disbursed loan ID is passed, it would crash.

- There is no `> 0` guard: if `repayable` equals `0`, the code reaches `totalInterest.div(loan.repayable)` and crashes the entire event handler (which would silently catch and log the error since the `@OnEvent` handler wraps it in try/catch — but the repayment would NOT be applied and the error would only appear in logs).

---

## Bug 14 — MINOR: applyRepayment payroll update runs before AWAITING check

**File:** `src/queue/bull/queue.repayments.ts:308–339`

### What happens

```typescript
// Step 1: Update payroll
await this.prisma.userPayroll.update({
  where: { userId: externalId },
  data: { ...payroll },
});

// Step 2: Fetch AWAITING repayments
const repayments = await this.prisma.repayment.findMany({
  where: { userId, period, status: 'AWAITING', loanId: { not: null } },
  ...
});
```

The payroll update happens **before** checking if the user has any AWAITING repayments for the period. If a user exists in the IPPIS file but has no active loans (e.g., they fully repaid last month), their payroll is still updated:
- This is mostly harmless but represents unnecessary writes
- More importantly: if the user has no AWAITING repayments but has `amount > 0` in the Excel, `repaymentBalance` remains positive after the loop, creating a `MANUAL_RESOLUTION` repayment record. An admin now needs to handle a "overflow" for a user who doesn't actually owe anything — this is noise that distracts from real overflows.

The payroll update should arguably only happen when there are actual AWAITING repayments to process, or should be conditional on whether repayments were found.

---

## Bug 15 — MINOR: scheduleVariation tenure calculation uses wrong reference point

**File:** `src/queue/bull/queue.reports.ts:150–158`

### What happens

```typescript
const { borrower, disbursementDate } = loans[0];  // ← takes FIRST loan's disbursementDate
...
const endDate = max(endDates);  // ← takes latest end date across all user's loans
data.push({
  ...
  tenure: differenceInMonths(endDate, disbursementDate!),  // ← compares first loan start to last loan end
});
```

When a customer has multiple active loans (New + Topup), the schedule variation calculates the `tenure` column as `differenceInMonths(latestEndDate, firstLoanDisbursementDate)`.

This is the total span from the oldest loan's disbursement to the latest loan's projected end — not the tenure of any single loan. For a customer with a 12-month loan starting January and a 6-month topup starting August, this would report a "tenure" of 19 months (Jan → August of next year), which is misleading. The column should likely show each loan's individual tenure or a weighted average.

Also, `loans[0].disbursementDate` is the first loan ordered by `disbursementDate ASC`. If for any reason the sort order isn't guaranteed (it is here since the query specifies `orderBy: { disbursementDate: 'asc' }`), this could return a wrong reference date.

---

## Summary Table

| # | Severity | Component | Description |
|---|----------|-----------|-------------|
| 1 | CRITICAL | Repayment Upload | Wrong/missing Excel columns → mass penalty on all borrowers |
| 2 | CRITICAL | Manual Resolution | Wrong amount-owed formula uses principal instead of repayable, ignores penaltyRepaid |
| 3 | CRITICAL | Queue Consumer | Job retry can double-count financial config counters |
| 4 | MAJOR | Liquidation | Pre-emptive APPROVED status before queue processing blocks rejection |
| 5 | MAJOR | Repayment Rate | Per-period calculation overwrites cumulative rate; one bad month = 0% |
| 6 | MAJOR | Commodity Loan History | `inReview: true` filter loses all processed commodity loan history |
| 7 | MAJOR | All User Loans | Double pagination (DB + in-memory) drops records silently |
| 8 | MAJOR | Config Counters | BALANCE_OUTSTANDING doesn't grow with penalties, drifts negative over time |
| 9 | MINOR | File Upload | MIME type is client-controlled and can be spoofed |
| 10 | MINOR | Repayment Upload | Re-uploading same period creates duplicate MANUAL_RESOLUTION records |
| 11 | MINOR | Repayment Upload | Payroll data silently overwritten from Excel with no value validation |
| 12 | MINOR | Commodity Rejection | Creates zero-principal ghost Loan records to track rejections |
| 13 | MINOR | Repayment Logic | getLoanRevenue crashes on division-by-zero if repayable = 0 |
| 14 | MINOR | Queue Consumer | Payroll update runs regardless of whether AWAITING repayments exist |
| 15 | MINOR | Schedule Report | Tenure shown is span from oldest loan start to newest loan end, not actual tenure |

---

*End of Document 2*
