# Critical Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three CRITICAL bugs in the repayment system: mass-penalty cascade from bad Excel, wrong amount-owed formula in admin manual resolution, and BullMQ liquidation job retry double-processing.

**Architecture:** All three fixes are surgical edits to existing files — no new modules or abstractions. Bug 1 reorders and gates operations inside `handleIPPISrepayment`. Bug 2 rewrites three lines in `adminResolveRepayment` and adds a missing `penaltyRepaid` update. Bug 3 adds an idempotency guard inside `allocateRepayment` for the liquidation code path.

**Tech Stack:** NestJS, BullMQ (Bull), Prisma, `@prisma/client` Decimal, Jest + `@nestjs/testing`

---

## File Map

| File | Change |
|------|--------|
| `src/queue/bull/queue.repayments.ts` | Bug 1: move `generateRepaymentsForActiveLoans` after header validation; Bug 3: add idempotency guard in `allocateRepayment` |
| `src/queue/bull/repayments.spec.ts` | Bug 1 tests; Bug 3 tests |
| `src/queue/events/events.admin.ts` | Bug 2: fix `adminResolveRepayment` — amount-owed formula, `penaltyRepaid` update, REPAID check |
| `src/queue/events/events.admin.spec.ts` | Bug 2 tests (new file) |

---

## Task 1: Bug 1 — Header validation before generating repayments

**Files:**
- Modify: `src/queue/bull/queue.repayments.ts:97` (reorder `generateRepaymentsForActiveLoans` call)
- Test: `src/queue/bull/repayments.spec.ts`

### What and why

`generateRepaymentsForActiveLoans` currently runs at line 97 — before the Excel headers are validated. If the file has wrong/missing columns, every active loan gets an AWAITING record, no rows are applied, and `markAwaitingRepaymentsAsFailed` penalises every borrower. The fix: validate required columns first, throw if any are missing, only then generate AWAITING records.

Required headers (normalised: lowercase, no spaces): `staffid`, `amount`, `employeegross`, `netpay`.

---

- [ ] **Step 1: Write the failing test**

Add inside `describe('RepaymentsConsumer Processor')` in `src/queue/bull/repayments.spec.ts`:

```typescript
describe('handleIPPISrepayment — header validation', () => {
  it('should throw before creating AWAITING repayments when required columns are missing', async () => {
    // Excel with wrong column names (no 'staffid', no 'amount')
    const badBuffer = makeXlsxBuffer([
      ['IPPIS_NUMBER', 'PAYMENT', 'GROSS', 'NET'],
      ['EMP001', 50000, 400000, 80000],
    ]);
    makeFetchOk(badBuffer);

    config.getValue.mockResolvedValue(0.05);
    // generateRepaymentsForActiveLoans would call loan.findMany
    prisma.loan.findMany.mockResolvedValue([]);

    const job = {
      data: { url: 'http://fake.url/file.xlsx', period: 'APRIL 2026' },
      progress: jest.fn(),
    } as unknown as Job<any>;

    await expect(
      consumer.handleIPPISrepayment(job),
    ).rejects.toThrow('Missing required columns: staffid, amount');

    // CRITICAL: generateRepaymentsForActiveLoans must NOT have run
    expect(prisma.repayment.createMany).not.toHaveBeenCalled();
  });

  it('should proceed normally when all required columns are present', async () => {
    const goodBuffer = makeXlsxBuffer([
      ['StaffID', 'Amount', 'EmployeeGross', 'NetPay'],
      ['EMP001', 71666.67, 400000, 80000],
    ]);
    makeFetchOk(goodBuffer);

    config.getValue.mockResolvedValue(0.05);
    prisma.loan.findMany.mockResolvedValue([]);
    prisma.repayment.findMany.mockResolvedValue([]);
    prisma.repayment.createMany.mockResolvedValue({ count: 0 });
    prisma.userPayroll.findMany.mockResolvedValue([]);

    const job = {
      data: { url: 'http://fake.url/file.xlsx', period: 'APRIL 2026' },
      progress: jest.fn(),
    } as unknown as Job<any>;

    await expect(consumer.handleIPPISrepayment(job)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/queue/bull/repayments.spec.ts --testNamePattern="header validation" -t "header validation"
```

Expected: FAIL — the test expecting a throw passes but `createMany` assertion fails (createMany IS called with the current code).

- [ ] **Step 3: Apply the fix in `queue.repayments.ts`**

Locate `handleIPPISrepayment`. Replace the block from after `this.debug('handleIPPISrepayment:excelParsed', ...)` through `await this.generateRepaymentsForActiveLoans(period);`:

```typescript
// BEFORE (lines ~91-97):
this.debug('handleIPPISrepayment:excelParsed', {
  headers,
  dataRows,
  totalRows,
});

await this.generateRepaymentsForActiveLoans(period);
```

```typescript
// AFTER:
this.debug('handleIPPISrepayment:excelParsed', {
  headers,
  dataRows,
  totalRows,
});

const REQUIRED_HEADERS = ['staffid', 'amount', 'employeegross', 'netpay'];
const normalised = headers.map((h) => h.toLowerCase().replace(/\s+/g, ''));
const missing = REQUIRED_HEADERS.filter((r) => !normalised.includes(r));
if (missing.length > 0) {
  throw new Error(
    `Invalid Excel format. Missing required columns: ${missing.join(', ')}`,
  );
}

await this.generateRepaymentsForActiveLoans(period);
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/queue/bull/repayments.spec.ts
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/queue/bull/queue.repayments.ts src/queue/bull/repayments.spec.ts
git commit -m "fix(repayments): validate Excel headers before generating AWAITING records

Prevents mass-penalty cascade when a wrong-format Excel is uploaded.
Missing required columns now throw immediately before any DB writes.
"
```

---

## Task 2: Bug 2 — Fix adminResolveRepayment formula

**Files:**
- Modify: `src/queue/events/events.admin.ts:117–161`
- Test: `src/queue/events/events.admin.spec.ts` (create if it doesn't exist)

### What and why

Three bugs in `adminResolveRepayment`:

**A** — `loan.principal.add(loan.penalty)` instead of `loan.repayable.add(loan.penalty)`. Ignores all interest in the amount-owed calculation; admin applies far less than the customer owes.

**B** — `principal.sub(loan.repaid)` does not subtract `loan.penaltyRepaid`, so prior penalty payments are double-counted as still owed.

**C** — REPAID check compares `loanRepaid` (which is just `loan.repaid + repaymentToApply`, not split into principal/penalty) against the wrong baseline. Also never updates `penaltyRepaid` on the loan, so penalty payments are silently lost.

The correct formula (matching `allocateRepayment`):
```
totalPayable   = loan.repayable + loan.penalty
alreadyPaid    = loan.repaid + loan.penaltyRepaid
amountOwed     = max(totalPayable − alreadyPaid, 0)
repaymentToApply = min(repaymentAmount, amountOwed)

revenue = getLoanRevenue(repaymentToApply, loan)
  → revenue.penalty          = penalty portion applied
  → revenue.principalPaid + revenue.interest = non-penalty portion applied

loan.repaid        += revenue.principalPaid + revenue.interest
loan.penaltyRepaid += revenue.penalty
REPAID if (loan.repaid + loan.penaltyRepaid) >= totalPayable
```

---

- [ ] **Step 1: Create `src/queue/events/events.admin.spec.ts` with the failing test**

Check whether this file exists first. If it does not exist, create it:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminEventsService } from './events.admin';
import { PrismaService } from 'src/database/prisma.service';
import { ConfigService } from 'src/config/config.service';
import { NotificationService } from 'src/notifications/notification.service';

const dec = (n: number | string) => new Prisma.Decimal(n);
const DECIMAL_ZERO = new Prisma.Decimal(0);

describe('AdminEventsService.adminResolveRepayment', () => {
  let service: AdminEventsService;
  let prisma: {
    loan: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    repayment: { findUniqueOrThrow: jest.Mock; update: jest.Mock; create: jest.Mock };
  };
  let config: { topupValue: jest.Mock; depleteValue: jest.Mock };

  beforeEach(async () => {
    prisma = {
      loan: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      repayment: { findUniqueOrThrow: jest.fn(), update: jest.fn(), create: jest.fn() },
    };
    config = { topupValue: jest.fn(), depleteValue: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: NotificationService, useValue: { sendInApp: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminEventsService>(AdminEventsService);
  });

  describe('amount-owed calculation', () => {
    it('should use repayable (not principal) when computing amount owed', async () => {
      // principal=500k, repayable=860k, no penalties, nothing repaid yet
      const loan = {
        principal: dec(500_000),
        repayable: dec(860_000),
        penalty: DECIMAL_ZERO,
        penaltyRepaid: DECIMAL_ZERO,
        repaid: DECIMAL_ZERO,
        interestRate: dec(0.06),
        tenure: 12,
        extension: 0,
      };
      const repayment = {
        amount: dec(900_000), // admin sends more than owed
        period: 'APRIL 2026',
        penaltyCharge: DECIMAL_ZERO,
        userId: 'user-1',
      };

      prisma.loan.findUniqueOrThrow.mockResolvedValue(loan);
      prisma.repayment.findUniqueOrThrow.mockResolvedValue(repayment);
      prisma.repayment.update.mockResolvedValue({});
      prisma.loan.update.mockResolvedValue({});
      config.topupValue.mockResolvedValue(undefined);
      config.depleteValue.mockResolvedValue(undefined);

      await service.adminResolveRepayment({
        id: 'rep-1',
        loanId: 'loan-1',
        note: 'manual resolution',
        userId: 'user-1',
      } as any);

      // repaymentToApply must be capped at repayable (860k), not principal (500k)
      const loanUpdateCall = prisma.loan.update.mock.calls[0][0];
      // repaid should be non-zero and reflect the non-penalty portion of 860k
      expect(loanUpdateCall.data.repaid.gt(dec(500_000))).toBe(true);
      // loan should be marked REPAID since 860k >= 860k
      expect(loanUpdateCall.data.status).toBe('REPAID');
    });

    it('should subtract penaltyRepaid when computing amount owed', async () => {
      // loan has penalty=5000, penaltyRepaid=5000 (fully cleared), repaid=800k
      const loan = {
        principal: dec(500_000),
        repayable: dec(860_000),
        penalty: dec(5_000),
        penaltyRepaid: dec(5_000),
        repaid: dec(800_000),
        interestRate: dec(0.06),
        tenure: 12,
        extension: 1,
      };
      const repayment = {
        amount: dec(100_000),
        period: 'APRIL 2026',
        penaltyCharge: DECIMAL_ZERO,
        userId: 'user-1',
      };

      prisma.loan.findUniqueOrThrow.mockResolvedValue(loan);
      prisma.repayment.findUniqueOrThrow.mockResolvedValue(repayment);
      prisma.repayment.update.mockResolvedValue({});
      prisma.loan.update.mockResolvedValue({});
      config.topupValue.mockResolvedValue(undefined);
      config.depleteValue.mockResolvedValue(undefined);

      await service.adminResolveRepayment({
        id: 'rep-1',
        loanId: 'loan-1',
        note: 'resolution',
        userId: 'user-1',
      } as any);

      // amountOwed = (860k+5k) - (800k+5k) = 60k, not 100k
      // repaymentToApply should be capped at 60k
      const repaymentUpdateCall = prisma.repayment.update.mock.calls[0][0];
      expect(repaymentUpdateCall.data.repaidAmount.toNumber()).toBeCloseTo(60_000, 0);

      // overflow of 40k should create a new MANUAL_RESOLUTION record
      expect(prisma.repayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'MANUAL_RESOLUTION' }),
        }),
      );
    });

    it('should update penaltyRepaid on the loan when penalty is applied', async () => {
      // loan has outstanding penalty of 3583
      const loan = {
        principal: dec(500_000),
        repayable: dec(860_000),
        penalty: dec(3_583),
        penaltyRepaid: DECIMAL_ZERO,
        repaid: dec(788_334),
        interestRate: dec(0.06),
        tenure: 12,
        extension: 1,
      };
      const repayment = {
        amount: dec(75_000), // enough to cover penalty + some principal
        period: 'APRIL 2026',
        penaltyCharge: DECIMAL_ZERO,
        userId: 'user-1',
      };

      prisma.loan.findUniqueOrThrow.mockResolvedValue(loan);
      prisma.repayment.findUniqueOrThrow.mockResolvedValue(repayment);
      prisma.repayment.update.mockResolvedValue({});
      prisma.loan.update.mockResolvedValue({});
      config.topupValue.mockResolvedValue(undefined);
      config.depleteValue.mockResolvedValue(undefined);

      await service.adminResolveRepayment({
        id: 'rep-1',
        loanId: 'loan-1',
        note: 'resolution',
        userId: 'user-1',
      } as any);

      const loanUpdateCall = prisma.loan.update.mock.calls[0][0];
      // penaltyRepaid must be incremented
      expect(loanUpdateCall.data.penaltyRepaid).toBeDefined();
      // repaid must also be incremented (non-penalty portion)
      expect(loanUpdateCall.data.repaid.gt(dec(788_334))).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npx jest src/queue/events/events.admin.spec.ts -t "amount-owed"
```

Expected: FAIL — first test passes on repaid check but second test fails because the current code uses principal, ignores penaltyRepaid, and doesn't update penaltyRepaid.

- [ ] **Step 3: Apply the fix in `events.admin.ts` lines 117–161**

Replace the buggy block:

```typescript
// REMOVE these lines (current buggy code):
const repaymentAmount = repayment.amount; // the overflow
const principal = loan.principal.add(loan.penalty);

const amountOwedRaw = principal.sub(loan.repaid);
const amountOwed = Prisma.Decimal.max(amountOwedRaw, 0);
const repaymentToApply = Prisma.Decimal.min(repaymentAmount, amountOwed);
```

```typescript
// REPLACE WITH:
const repaymentAmount = repayment.amount;
const totalPayable = loan.repayable.add(loan.penalty);
const alreadyPaid = loan.repaid.add(loan.penaltyRepaid);
const amountOwedRaw = totalPayable.sub(alreadyPaid);
const amountOwed = Prisma.Decimal.max(amountOwedRaw, new Prisma.Decimal(0));
const repaymentToApply = Prisma.Decimal.min(repaymentAmount, amountOwed);
```

Then replace the loan update block (current lines 152–161):

```typescript
// REMOVE:
const revenue = logic.getLoanRevenue(repaymentToApply, loan);

const loanRepaid = loan.repaid.add(repaymentToApply);
await this.prisma.loan.update({
  where: { id: dto.loanId! },
  data: {
    repaid: loanRepaid,
    ...(loanRepaid.gte(principal) && { status: 'REPAID' }),
  },
});
```

```typescript
// REPLACE WITH:
const revenue = logic.getLoanRevenue(repaymentToApply, loan);
const loanRepaid = loan.repaid.add(
  revenue.principalPaid.add(revenue.interest),
);
const totalRepaid = loanRepaid.add(loan.penaltyRepaid).add(revenue.penalty);

await this.prisma.loan.update({
  where: { id: dto.loanId! },
  data: {
    repaid: loanRepaid,
    penaltyRepaid: { increment: revenue.penalty },
    ...(totalRepaid.gte(totalPayable) && { status: 'REPAID' }),
  },
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/queue/events/events.admin.spec.ts
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/queue/events/events.admin.ts src/queue/events/events.admin.spec.ts
git commit -m "fix(admin): correct adminResolveRepayment amount-owed formula

Three bugs fixed:
- Use repayable (not principal) as owed base — captures interest
- Subtract penaltyRepaid from alreadyPaid — no double-counting prior penalty payments
- Update penaltyRepaid on loan and use full totalRepaid for REPAID check
"
```

---

## Task 3: Bug 3 — Idempotency guard for liquidation job retries

**Files:**
- Modify: `src/queue/bull/queue.repayments.ts:576–636` (`allocateRepayment`)
- Test: `src/queue/bull/repayments.spec.ts`

### What and why

When a `process_liquidation_request` BullMQ job is retried (e.g., because the `LiquidationRequest.update` to `APPROVED` fails after the allocation already succeeded), `allocateRepayment` runs again. Because `repaymentId` is not set in the liquidation path, `prisma.repayment.create` is called again for loans that were already processed, creating duplicate repayment records and double-counting config updates.

The fix: before creating a repayment, check if one with the same `liquidationRequestId` + `loanId` already exists. If it does, subtract its `repaidAmount` from `repaymentBalance` to track progress, add its financials to `singleStats` so global configs are kept in sync on the retry, and skip re-processing that loan.

---

- [ ] **Step 1: Write the failing test**

Add inside `describe('RepaymentsConsumer Processor')` in `src/queue/bull/repayments.spec.ts`:

```typescript
describe('handleLiquidationRequest — retry idempotency', () => {
  it('should not create duplicate repayment records when job is retried', async () => {
    const loanId = 'loan-1';
    const liquidationRequestId = 'liq-1';
    const userId = 'user-1';

    // Simulate: first run already created a repayment for this loan
    const existingRepayment = {
      id: 'rep-existing',
      repaidAmount: dec(860_000),
      interest: dec(360_000),   // for stats reconstruction
      penalty: dec(0),
    };

    prisma.loan.findMany.mockResolvedValue([
      {
        id: loanId,
        principal: dec(500_000),
        repayable: dec(860_000),
        penalty: dec(0),
        penaltyRepaid: dec(0),
        repaid: dec(860_000),    // already fully repaid from first run
        interestRate: dec(0.06),
        tenure: 12,
        extension: 0,
        disbursementDate: new Date('2025-01-01'),
      },
    ]);

    prisma.repayment.findFirst = jest.fn().mockResolvedValue(existingRepayment);
    prisma.repayment.update.mockResolvedValue({});
    prisma.liquidationRequest.update.mockResolvedValue({});

    const job = {
      data: {
        amount: 860_000,
        userId,
        liquidationRequestId,
        period: 'APRIL 2026',
      },
    } as unknown as Job<any>;

    await consumer.handleLiquidationRequest(job);

    // No new repayment should be created
    expect(prisma.repayment.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/queue/bull/repayments.spec.ts --testNamePattern="retry idempotency"
```

Expected: FAIL — `repayment.create` is called (no guard exists yet). Note: you may need to add `prisma.repayment.findFirst` to the prisma mock object in `beforeEach`.

Add `findFirst: jest.fn()` to the `repayment` mock in the `beforeEach` block if it's not already there:

```typescript
repayment: {
  findMany: jest.fn(),
  findFirst: jest.fn(),   // add this
  createMany: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
},
```

- [ ] **Step 3: Apply the fix in `queue.repayments.ts` inside `allocateRepayment`**

Locate the block starting at `if (repaymentId) {` inside `allocateRepayment`. Wrap the entire `else` branch with an idempotency guard:

```typescript
// CURRENT (buggy — no guard):
} else {
  await this.prisma.repayment.create({
    data: {
      id: generateId.repaymentId(),
      amount,
      period,
      repaidAmount: repaymentAmount,
      expectedAmount: repaymentAmount,
      periodInDT,
      userId,
      loanId: loan.id,
      status: 'FULFILLED',
      liquidationRequestId: dto.liquidationRequestId,
    },
  });
}
```

```typescript
// FIXED — with idempotency guard:
} else {
  if (dto.liquidationRequestId) {
    const existing = await this.prisma.repayment.findFirst({
      where: { liquidationRequestId: dto.liquidationRequestId, loanId: loan.id },
      select: { repaidAmount: true },
    });
    if (existing) {
      // Already processed on a prior attempt — count it in stats and move on
      singleStats.totalRepaid += existing.repaidAmount.toNumber();
      const rev = logic.getLoanRevenue(existing.repaidAmount, loan);
      singleStats.totalInterestRevenue += rev.interest.toNumber();
      singleStats.totalPenaltyRevenue += rev.penalty.toNumber();
      repaymentBalance = repaymentBalance.sub(existing.repaidAmount);
      continue;
    }
  }

  await this.prisma.repayment.create({
    data: {
      id: generateId.repaymentId(),
      amount,
      period,
      repaidAmount: repaymentAmount,
      expectedAmount: repaymentAmount,
      periodInDT,
      userId,
      loanId: loan.id,
      status: 'FULFILLED',
      liquidationRequestId: dto.liquidationRequestId,
    },
  });
}
```

- [ ] **Step 4: Run all repayment tests**

```bash
npx jest src/queue/bull/repayments.spec.ts
```

Expected: all passing including the new idempotency test.

- [ ] **Step 5: Commit**

```bash
git add src/queue/bull/queue.repayments.ts src/queue/bull/repayments.spec.ts
git commit -m "fix(repayments): add idempotency guard to liquidation job retry path

On BullMQ retry, allocateRepayment now detects already-processed
repayments via liquidationRequestId+loanId lookup and skips re-creation.
Stats are reconstructed from the existing record to keep global
config counters consistent.
"
```

---

## Self-Review

**Spec coverage:**
- Bug 1 (mass penalty cascade): ✓ Task 1 — header validation before `generateRepaymentsForActiveLoans`
- Bug 2 (wrong amount-owed formula, all three sub-bugs A/B/C): ✓ Task 2 — fixes formula, adds `penaltyRepaid` update, fixes REPAID check
- Bug 3 (retry double-processing for liquidation): ✓ Task 3 — idempotency guard with stat reconstruction

**Placeholder scan:** No TBDs, no "similar to Task N" references, all code blocks are complete.

**Type consistency:**
- `revenue.principalPaid.add(revenue.interest)` — both fields exist on the return type of `getLoanRevenue` ✓
- `dto.liquidationRequestId` — present on `LiquidationResolution` and threaded through `PrivateRepaymentHandler` as optional ✓
- `singleStats.totalRepaid` / `totalInterestRevenue` / `totalPenaltyRevenue` — all fields of `FinancialAccumulator` ✓

**Known limitation not addressed (acceptable scope):** The `updateLoanRecord` REPAID check uses only the current period's `penaltyPaid` rather than cumulative `loan.penaltyRepaid`. This is a pre-existing gap that only manifests when penalties are paid off in a prior period and the final regular payment comes in a later period. This is lower priority and should be tracked as a separate MAJOR bug fix.
