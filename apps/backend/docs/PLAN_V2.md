# PLAN_V2 — Variations and vouchers per organization

Stakeholder direction (2026-10-06): variations are generated **per organization**, as often as needed in a month, each
one replacing the last, until that organization's **voucher** (its repayment file, today's payroll upload) lands. The
voucher locks the variation and does what "close period" did. Close period goes away.

This plan replaces the period-level rules in V2.MD §0.5 (Variation for P, Close period P, Payroll row) and the
`/admin/payroll-variations*`, `/admin/repayments/upload|validate` and `close-period` routes in §0.6. Apply it in stages,
like V2.MD; when a stage is done, mark it `Status: done (date)` here.

## 0. Context

### 0.1 Where we start

- **v2 is live.** It runs on Railway (project MicroBuilt Prime, environment `production`). The service
  `ravishing-light` deploys every push to `v2`, and its pre-deploy step runs `db:deploy` against the `railway` database
  on the project's Postgres (`altaria.proxy.rlwy.net:10576`). That is the only app database, and `apps/backend/.env`
  points at it too. **Development, scripts and the `LEDGER_IT` specs run against it** (decided 2026-10-06; its data is
  test data).
- **So the work happens on branch `v2-org-variations`**, merged into `v2` once Stages A–E are done; a push to `v2`
  would deploy half of it. Applying Stage A's migration from here changes the live database under the deployed
  service, so the live v2 API breaks until the merge deploys. Migrations are applied with `prisma migrate deploy` only.
  `migrate dev` compares against a shadow database, sees the `invariants.sql` indexes as drift, and offers to reset
  the database.
- **The database holds test data** (as of 2026-10-06):
  - 3 months: SEPTEMBER 2026 submitted, OCTOBER and NOVEMBER open;
  - 6 loans and 11 deductions;
  - one September upload, `NPF SEPTEMBER 2026 PRINTOUT SAMPLE.xlsx`, with 5 rows;
  - 6 payroll records whose `organization` values are `npf`, `lagos`, `akwaibom` and three state commands. All 6 are
    really NPF. Most likely the upload's rows wrote the command names over the org: `payrollUpdate` in
    `queue.repayments.ts` copies the row's organization column onto the record. This plan stops that (P2).

  September's variation and upload are dropped, so the data starts fresh; customers, loans and the other deductions
  are kept (Stage A, step 1).
- **Today's model:** one `PayrollPeriod` per month. `variationSubmittedAt` freezes it (OPEN → AWAITING, opens P+1).
  Uploads need a submitted month. `close` fails and penalizes, then sets `closedAt`. Organization is free text on
  `CustomerPayroll`.

### 0.2 Terms

| Term | Meaning |
| --- | --- |
| **Month** | A `Period` row (`year`, `month`): the calendar month. Deductions and inflows belong to a month. |
| **Org** | An `Organization` row, mapped from `CustomerPayroll.organization`. A loan's org is its borrower's. |
| **Variation (X, P)** | Org X's variation for month P, one per (org, month), today's `PayrollPeriod`. It holds **every** deduction it froze (`Deduction.variationId`); its file lists only the ones that changed. Only a generation creates one. |
| **Generate** | Freeze X's deductions for P and write the variation file (version + 1). |
| **Voucher** | X's repayment file for P, today's `PayrollUpload`, uploaded into Variation (X, P). |
| **No payroll** | The voucher for a generated month never came: `noPayrollReason` is set, and everyone in the variation is penalized (R5). |
| **Locked** | The variation has a voucher **or** a `noPayrollReason`. Locking settles it (FAILED/PARTIAL, penalties, next-month rows) in the same step. A locked variation is never regenerated and takes no other voucher; only a revert (R6) unlocks it. |
| **Issue** | A voucher row that couldn't be paid against its deduction: an UNMATCHED or REVIEWING inflow. The inflow records the issue and when it happened; an admin resolves it later (manual resolution, as now). |
| **Skipped** | X has no deduction in P (none of its people has a running loan): nothing to generate, no variation, no voucher. |
| **lastSent** | A loan's latest non-OPEN deduction amount: what payroll has on file for it. Already in `balances.ts`. |

### 0.3 Decisions (locked)

| # | Decision |
| --- | --- |
| P1 | `Period` is the calendar month. It is today's `PayrollPeriod` table renamed, with the same ids. `Deduction.periodId` and `PaymentInflow.periodId` keep pointing to it, so the unique index `(externalUserId, periodId)` on PAYROLL inflows is unchanged. Liquidations get the current Lagos month, as now. |
| P2 | `Organization { id, name, normalizedName @unique }`; `CustomerPayroll.organizationId` replaces the `organization` string. A payroll record's *first* org is found or created where the record is created: admin onboarding (`customers.service.ts`), bulk import (`queue.service.ts`, `importRow`) and the PAYROLL change request (`change-requests.service.ts`). `normalizedName` = trimmed, lower-case, single spaces. **After that, the org changes only through an ORGANIZATION change request (P12).** Vouchers no longer write `organization` (they still update net pay, grade, step and command). |
| P3 | `Variation { id, periodId, organizationId, version Int @default(1), filePath String, noPayrollReason String?, createdAt, updatedAt @updatedAt }`, `@@unique([periodId, organizationId])`. Relations: `deductions Deduction[]` and `voucher Voucher?`. `variationSubmittedAt` and `closedAt` are gone. |
| P4 | Each generation writes `variations/<orgId>/<YYYY-MM>/v<version>.xlsx` and points `filePath` at it (`version + 1`; `@updatedAt` moves). Superseded versions stay in the bucket until the variation locks, so you can see what the org was sent. When it locks, every version but the current one is deleted. If a generation's commit fails, its new object is deleted. |
| P5 | `Voucher` is today's `PayrollUpload`, renamed: `variationId @unique` replaces `periodId`; `fileHash`, `filename`, `uploadedById` and `createdAt` are unchanged. **The org is chosen in the frontend** (`organizationId` on the upload), and the month comes from the sheet's Period column or the `period` param, as now. The sheet's organization column isn't checked or written, and it stops being a required column (`repayment-validation.ts`): it holds commands (NPF's file). A row whose customer is in another org → REVIEWING. |
| P6 | A month X has deductions in must be generated, even when nothing changed: the org is still sent its variation, and the voucher needs one. The file then holds only its headers. "Generate all orgs" covers every org with deductions in P and leaves out the rest (skipped). |
| P7 | Close period is removed (route, `PeriodCloseService`). Its work runs when a voucher finishes, or on no payroll. |
| P8 | Vouchers go in month order per org. A voucher for Variation (X, P) is refused while X has an unlocked variation for an earlier month. The refusal names it and offers **No payroll** for it (R5), then the upload goes ahead. Nothing is accepted for a month before X's latest locked variation (no reversing). Orgs are independent: Navy's November can be locked while Police's October is open. |
| P9 | Variations go in month order per org, and never backwards. Navy's November can be generated only once Navy's October variation exists, unless Navy had no deductions in October (skipped, or its first loans start in November). October can't be generated once November exists. October doesn't have to be locked first: November may have to go to Navy before October's voucher comes back. |
| P10 | Variation drafts come back: `POST /admin/variations/draft` emails the xlsx that generating would produce now, with nothing frozen. |
| P11 | A voucher can be reverted only while its month is still the current Lagos month and X has no variation for the next month: a voucher for October uploaded on 3 November can never be reverted. A no payroll can be reverted as long as the next month has no voucher (R6). There is no revert for a generation: generate again. |
| P12 | Org switches are change requests: a new `ChangeRequestKind.ORGANIZATION` (payload `{ organizationId }`). **Any admin proposes one, a SUPER_ADMIN approves it.** One per customer, or in bulk from a list of external ids (IPPIS / staff ids: paste or a one-column sheet). The change-request routes let ADMIN approve today (`@Access('ADMIN', 'SUPER_ADMIN')`), so approving this kind needs its own SUPER_ADMIN check. When a customer changes org, a deduction stays with the variation it was sent in. The new org's variation lists the loan as START, because the prior is counted within the org. The old org's next variation lists a STOP for it (Stage D, step 6). Merging two orgs (a misspelling) stays a separate SUPER_ADMIN action. |
| P13 | Generating, uploading vouchers (as uploads are today), no payroll, reverts, org merges and approving org switches are **SUPER_ADMIN**. Previewing, drafts and proposing org switches are open to every admin. |

## 1. Domain rules (replace V2.MD §0.5 "Variation", "Close period", "Payroll row")

The formula (`openExpected`, `committed`, `frozenCount`, `lastSent`) is unchanged. A loan has at most one OPEN deduction
(as now). It may also hold AWAITING deductions in unlocked variations. One AWAITING plus one OPEN is the new "sent
this month, changed since" state.

**R1. Where an OPEN deduction goes.** At disbursement, or when `refreshOpen` finds none and the loan is still
DISBURSED: month = max(disbursement month, month after the loan's latest non-OPEN deduction). That month moves forward
past any month for which the loan's org already has a variation. `refreshOpen` therefore *creates* the next month's row
when needed. Today the submit creates all of them.

> Example. Navy's October is generated on 15 Oct.
> - Loan A is disbursed on 20 Oct → its first deduction opens in **November**, because October already has a
>   variation.
> - A top-up on 21 Oct to loan C, whose October deduction is AWAITING → C gets an OPEN **November** row.
> - October is regenerated on 28 Oct → A is pulled into October (it was disbursed in October, so October's salary can
>   carry it). C's November row is folded back into October and recomputed.
> - Loan B is disbursed on 2 Nov, while October still waits for its voucher. A regeneration of October on 3 Nov
>   **does not pull B in**: its first month is November.

**R2. Preview (X, P).** These rows are what generating would freeze:
- (a) OPEN(P) of X's loans;
- (b) AWAITING(P) in Variation (X, P), plus any OPEN(P+1) on the same loan, folded in;
- (c) OPEN(P+1) of X's loans with no deduction in P and disbursement month ≤ P;
- (d) X's DISBURSED loans with no deduction in P or later, i.e. loans waiting only on an earlier unlocked variation:
  OPEN(P) is created first, per R1.

For (b) and (c), the amount is the formula as if the P row were OPEN: `committed` and `frozenCount` leave it out. Each
row is classified against **prior** = the loan's latest non-OPEN deduction in a month < P whose variation has org X
(a history row with no variation also counts, see Stage D, step 4). No prior or prior 0 → START; different amount →
AMEND (0 = STOP); equal → frozen but kept off the file. Reasons and columns are as now. No rows at all → X is skipped
for P.

**R3. Generate (X, P).** SUPER_ADMIN. Runs as a queue job per org; job id `variation:<orgId>:<ym>` drops double clicks.

Guards (P9):
- Variation (X, P) not locked;
- X has no variation for a later month ("Navy's November already exists: October can't change any more");
- X has no OPEN deduction in a month before P ("generate Navy's October first"). That is how "November needs October"
  is checked: a month whose deductions were all frozen by its variation has no OPEN rows left. A month X had no
  deductions in never had any. Without this guard, R2 (d) would give those loans a second OPEN row;
- X has deductions for P (R2 not empty).

There is no "month has ended" guard any more: generation happens during the month. An earlier unlocked variation
doesn't block it.

One transaction:
1. `ensure` Variation (X, P), then `FOR UPDATE`.
2. Lock the loans.
3. Apply R2:
   - (a) and (d) → AWAITING, `variationId` set;
   - (b) → recompute the AWAITING amount and delete the OPEN(P+1);
   - (c) → move to P, AWAITING, linked.
4. Build the file from the variation's AWAITING rows that changed against prior (header-only when none, P6).
5. P4 for the object.
6. Audit `VARIATION_GENERATED` with the version and counts.

If an earlier month locks after P was generated, its penalties change P's amounts. Regenerate P to pick them up (while
P+1 hasn't been generated). The frontend shows a "regenerate" hint when a variation was last generated (`updatedAt`)
before X's previous month last locked or was reverted (the latest `VOUCHER_UPLOADED`, `NO_PAYROLL` or
`*_REVERTED` audit entry on that variation).

**R4. Voucher upload** (`organizationId` + file, optional `period`).
- **Sync checks.** Refused when:
  - there is no Variation (X, P) ("generate Navy's October variation first");
  - it is locked;
  - the file hash has been seen before;
  - X has an earlier unlocked variation. The 409 names those months so the frontend can offer No payroll for them
    (P8).
- **Job, step 1 — rows.** One inflow per row, idempotent as now. Pay it against the loan's AWAITING deduction *in this
  variation*. When it can't be paid, the row becomes an issue, as now:
  - no customer with that staff id → UNMATCHED;
  - the customer is in another org, or the loan isn't in this variation → REVIEWING.
- **Step 2 — settle the variation** (`settleVariation`), straight after the last row. It re-runs and skips finished
  deductions, as `close` does today:
  - every deduction of the variation not yet `penalizedAt` follows the old close rule: FULFILLED if the loan is no
    longer DISBURSED or the amount is 0; otherwise AWAITING → FAILED, then penalize any shortfall, then the cap check;
  - the penalty MicroLoan and any proposed TenureChange carry `variationId`, which is what a revert undoes (R6).
- **Step 3 —** `refreshOpen` on each loan, which creates OPEN(P+1) per R1. Delete the superseded variation files (P4).
  Audit `VOUCHER_UPLOADED` with the counts, issues included.

**R4b. Rematching an issue.** Issues are resolved afterwards by manual resolution (`repayments.service.ts`). APPLY finds
the customer's deduction through the inflow's voucher → variation instead of its month. When that deduction was
settled by this voucher (FAILED or PARTIAL, `penalizedAt` set), the rematch undoes the settlement for that one loan,
in one transaction:
1. Delete its penalty MicroLoan (the one carrying this `loanId` + `variationId`; there is at most one) and any PENDING
   tenure change carrying the `variationId`.
2. Put the deduction back to AWAITING (`settledAt`, `penalizedAt` cleared).
3. Pay the inflow against it, as the voucher job would have.
4. Re-run `settleVariation` for that deduction alone: FULFILLED, or PARTIAL with a penalty on what's still short.
5. `refreshOpen`. Audit as manual resolutions are now, noting the penalty cleared.

The undo is only safe while nothing has been paid on top of the penalty. Payments go to penalties first, so a later
payment may already have collected part of it. So the rematch falls back to today's behaviour (the money pays the
loan, the penalty stays, the response says why) when either holds:
- the loan's collected penalty is more than what would remain booked without this penalty;
- the tenure change from it is no longer PENDING.

A deduction in another variation (a REVIEWING row from another org) isn't touched: it settles with its own org's
voucher.

**R5. No payroll (X, P).** SUPER_ADMIN, reason required. Refused when:
- Variation (X, P) doesn't exist or is locked;
- P hasn't ended (Lagos);
- X has an earlier unlocked variation (order still holds; do the earliest first).

It sets `noPayrollReason`, then runs steps 2 and 3: nothing came, so everyone in the variation is FAILED and penalized.
Audit `NO_PAYROLL`. Reached from the variations page, or from the voucher refusal in R4 ("Navy's October has no voucher:
mark it No payroll and continue?").

**R6. Revert a voucher (P11).** SUPER_ADMIN, reason required. Allowed only while:
- **Its month is still active**: P is the current Lagos month.
- **X has no variation for P+1.** A P+1 variation was computed from what this voucher left.

It is also refused, to keep the money right, when:
- a Repayment on any of the variation's loans was created after the voucher and doesn't come from it (an accepted
  liquidation): how it was split depends on the penalties being undone;
- a tenure change carrying this `variationId` is no longer PENDING.

Otherwise, in one transaction:
1. Delete the voucher's inflows (resolved issues included), their repayments and breakdowns, the voucher row and its
   stored file. A loan this made REPAID goes back to DISBURSED.
2. Delete the penalty MicroLoans and PENDING tenure changes carrying the `variationId`.
3. Put the variation's deductions back to AWAITING, clearing `settledAt` and `penalizedAt`.
4. `refreshOpen` each loan.
5. Audit `VOUCHER_REVERTED`.

A **no payroll** is undone the same way (clear `noPayrollReason`, steps 2–5, audit `NO_PAYROLL_REVERTED`). Its
conditions differ:
- **P+1 must not be locked** (no voucher, no no payroll). P+1 may already be generated. Its amounts then include
  P's penalties, so it gets the regenerate hint (R3).
- The liquidation and tenure-change refusals above still apply.

The usual case is the voucher turning up after the month was marked No payroll: revert, then upload it into P.

Not undone:
- the payroll details the voucher rows wrote (net pay, grade, step, command), as with any upload today;
- superseded files deleted at lock (P4); the current version is all payroll had anyway.

**R7. Liquidation** is unchanged apart from P1. Approving it calls `refreshOpen`, which follows R1.

**R8. Repayment rate** = collected / expected over deductions whose variation is locked (a voucher, or no payroll).
Not "`penalizedAt` set": the settle step only stamps rows that came in short, so a month paid in full would drop out.
Dashboard "latest closed period", and the latest-closed-month repayment counts in `customers.service.ts`
(`getRepaymentStatusCounts`), become the latest locked month per org.

## 2. API contract (Stages B–E build against this)

Responses keep the usual `{ data, message }` envelope; shapes below are `data`. `OrgRef = { id: string; name: string }`,
`Month = { ym: string; label: string }` ("2026-10", "OCTOBER 2026"). Dates are ISO strings. Access is
`ADMIN | SUPER_ADMIN` unless a route says SUPER_ADMIN. Money is a number (naira, 2 dp). A deviation found while building
is reported back, not improvised: the frontend codes against this section.

```ts
type Lock =
  | { kind: 'VOUCHER'; voucherId: string; filename: string; uploadedAt: string }
  | { kind: 'NO_PAYROLL'; reason: string };

// Today's VariationRow, unchanged: loanId, customerId, externalId, name, command, balance, amount, tenure,
// action ('START' | 'AMEND' | 'STOP'), reasons (NEW_LOAN | TOPUP | LIQUIDATION | TENURE_CHANGE | DEFAULT)[], start, end.
type VariationRowDto = { /* as today */ };

interface VariationState {
  id: string; version: number; createdAt: string; updatedAt: string;
  lock: Lock | null;
  regenerateHint: boolean;      // R3
  versions: number[];           // file versions still kept (P4), ascending
}
```

**Variations (Stage B), `src/admin/variations/`**

| Route | Body / query | `data` |
| --- | --- | --- |
| `GET /admin/variations` | `?organizationId&period=YYYY-MM&action?&reason?` | `{ organization: OrgRef; period: Month; variation: VariationState \| null; rows: VariationRowDto[] (filtered); counts: { START; AMEND; STOP } (unfiltered); frozen: number (deductions generating would freeze, unchanged ones included); skipped: boolean; generateBlockedBy: string \| null }`. Once a variation is locked, `rows` are what its current version holds. |
| `GET /admin/variations/history` | `?organizationId` | `{ id; period: Month; version; updatedAt; lock: Lock \| null }[]`, newest month first |
| `POST /admin/variations/generate` | SUPER_ADMIN, `@Confirm('action')`. `{ period: 'YYYY-MM'; organizationIds?: string[]; all?: boolean }` | `{ period: Month; queued: OrgRef[]; skipped: OrgRef[]; refused: (OrgRef & { reason: string })[] }`. One job per queued org; the requester gets an in-app notification when each finishes or fails. |
| `POST /admin/variations/draft` | `{ period; organizationId }` | `{ period: string (label); organization: string; email: string }` |
| `GET /admin/variations/:id/file` | `?version` (default: current) | `{ url; expiresIn; filename }` |

**Vouchers, no payroll, rematch (Stage C), in `src/admin/repayments/`**

| Route | Body / query | `data` |
| --- | --- | --- |
| `POST /admin/vouchers` | SUPER_ADMIN, `@Confirm('action')`, direct upload, multipart `{ file; organizationId; period? }` | `{ voucherId; variationId; organization: OrgRef; period: string (label); rows: number }`. The 409 for earlier unlocked months is `{ statusCode: 409; message; earlierUnlocked: { variationId; ym; label }[] }`; every other error is a plain message. |
| `POST /admin/vouchers/validate` | SUPER_ADMIN, same multipart | today's sheet report plus `{ organization: OrgRef; variation: { id; version } \| null; issues: { unmatched; otherOrganization; notInVariation }; earlierUnlocked: { variationId; ym; label }[]; conflicts: string[] }` |
| `DELETE /admin/vouchers/:id` | SUPER_ADMIN, `@Confirm('action')`, `{ reason }` | `{ variationId; inflowsRemoved; penaltiesRemoved; proposalsWithdrawn }` |
| `POST /admin/variations/:id/no-payroll` | SUPER_ADMIN, `@Confirm('action')`, `{ reason }` | `{ variationId; label; failed; penalties; penaltyTotal; proposals }` |
| `DELETE /admin/variations/:id/no-payroll` | SUPER_ADMIN, `@Confirm('action')`, `{ reason }` | `{ variationId; penaltiesRemoved; proposalsWithdrawn }` |
| `PATCH /admin/repayments/inflows/:id/manual-resolution` | unchanged | today's result plus `{ penaltyCleared: boolean; fallbackReason: string \| null }` (R4b) |
| Inflow list, detail, export | filter `?voucherId` (was `uploadId`) | the inflow's `uploadId` field becomes `voucherId` |
| **Removed** | | `/admin/payroll-variations/*`; `/admin/repayments/upload`, `/validate`, `/close-period` |

**Organizations and reads (Stage D), `src/organizations/` and the modules that read them**

| Route | Body / query | `data` |
| --- | --- | --- |
| `GET /admin/organizations` | | A–Z `{ id; name; customers: number; runningLoans: number; latestLocked: Month \| null; unlocked: { variationId; ym; label; version; updatedAt; regenerateHint }[]; deductionsThisMonth: boolean }[]` |
| `POST /admin/organizations/:id/merge` | SUPER_ADMIN, `@Confirm('action')`, `{ intoId }` | `{ intoId; movedPayrolls: number }` |
| `POST /admin/organizations/:id/switch-requests` | `{ externalIds: string[] }` | `{ results: { externalId; outcome: 'CREATED' \| 'NOT_FOUND' \| 'ALREADY_IN_ORGANIZATION' \| 'PENDING_EXISTS'; requestId?: string }[] }`. Approved through `POST /admin/change-requests/:id/approve`, SUPER_ADMIN only for this kind. |
| `GET /admin/customers` | filter `organizationId` (was `organization`, a name) | unchanged |
| Customer payroll in every response (`/admin/customer/:id`, `/user/payroll`, exports, reports) | | keeps `organization` (the name) and adds `organizationId` |
| `GET /admin/dashboard/operations` (today's route) | | `awaitingPayrollPeriod` and `nextVariationPeriod` are replaced by `organizations: { id; name; latestLocked: Month \| null; awaitingVoucher: Month[]; toGenerate: Month \| null }[]`; `lastRepaymentRun` keeps its shape (latest voucher anywhere) and adds `organization: string` |
| **Removed** | | `GET /admin/customers/organizations` (use `/admin/organizations`) |

## Stage A — Fresh start, schema, migration, organizations

**Status: done (2026-10-06), except that the migration is rehearsed, not applied.** As built, where it differs from
the steps below:
- **The reset (step 1)** ran on the live database: 5 payroll inflows and their repayments gone, one OPEN deduction
  per loan in its disbursement month, every payroll record in NPF. Its own check was clean, and the backup is
  `~/microbuilt-backups/reset-september-2026-2026-10-06T21-34-40-163Z.json`. The script was committed alone (it
  targets the old schema) and removed in the Stage A commit.
- **The migration** (`20261010090000_organization_variations`) drops the emptied `PayrollUpload` and creates
  `Voucher` fresh (likewise `PaymentInflow.uploadId` → a new `voucherId`), rather than renaming them. `PayrollPeriod`
  is renamed to `Period`, keeping its ids, because deductions and inflows point at it.
  - Rehearsed on the live database inside a transaction that rolls back: 1 organization (NPF), every payroll record
    assigned.
  - `migrate diff` from the migrations against a throwaway shadow database: no difference.
  - **Not applied**: it would break the deployed v2 API. Apply it with `prisma migrate deploy` (then `pnpm
    db:invariants`) once Stages B and C compile.
- **Organizations** are functions in `src/organizations/organizations.ts` (`normalizeOrganizationName`,
  `findOrCreateOrganization`), wired into onboarding, bulk import and the PAYROLL change request. The list and merge
  come with the Stage D routes. `GET /admin/customers/organizations` and the customer organization filter keep their
  contract (id = name) until Stage D.
- **`PeriodsService`**: `firstOpenMonthFor` (R1) replaces `firstUnsubmittedFrom`, and `openFirst` uses it.
  `openVariationPeriod` and `awaitingPayrollPeriod` stay until the dashboard goes per organization (Stage D).
- **Repayment rate and the customer status counts** read locked variations (R8, corrected).
- **Still failing typecheck (Stages B–D):** `variation.service.ts`, `period-close.service.ts`,
  `payroll-upload.service.ts`, `queue.repayments.ts`, `repayments.service.ts` (the variation routes),
  `ledger.integration.spec.ts`, `queue.maintenance.ts` and `scripts/smoke-v2.ts`. All 49 unit suites pass.

1. **Before the migration**, a one-off script, `scripts/maintenance/reset-september-2026.ts`. It runs on the old
   schema, does a dry run by default, and with `--apply` runs in one transaction. Before writing anything, it saves
   every row it will delete or change as JSON (outside the repo), since `pg_dump` isn't available here.
   1. Delete September's upload: its inflows, their repayments and breakdowns, the `PayrollUpload` row and its stored
      file. Any loan that this leaves owing goes back to DISBURSED.
   2. Undo the September submission, as `VariationService.revert` does, but without its blockers (they are what
      step 1 just removed). **In this order**, because `Deduction_one_open_per_loan` allows one OPEN per loan:
      1. delete the October OPEN rows that the submit opened for September's loans;
      2. put September's deductions back to OPEN, with `settledAt`/`penalizedAt` cleared;
      3. clear `variationSubmittedAt`/`variationFilePath` and delete the `2026-09.xlsx` object.

      A loan with no September row (disbursed after the submit) keeps one OPEN row, in its disbursement month (R1
      with nothing frozen), not the old revert's blanket "move it back to September".
   3. Recompute each loan's OPEN amount (`loanBalances` + `openExpected`; the script has no Nest container).
   4. Set every `CustomerPayroll.organization` to `NPF`.
   5. Delete the audit rows the migration's enum changes would orphan: entity types `PAYROLL_PERIOD`/`PAYROLL_UPLOAD`,
      and actions `VARIATION_SUBMITTED`, `VARIATION_REVERTED`, `PERIOD_CLOSED`, `PAYROLL_UPLOADED`. That is test
      history only; `reset-customer-data.ts` removes the same kinds.
   6. Print each loan's owed/repaid/outstanding before and after. Repaid drops by exactly the deleted repayments,
      and nothing else moves.

   The result is no submitted month, no upload, every running loan with one OPEN deduction (September's loans back
   in September, ready to be generated again with the NPF sample voucher), and every customer in NPF.
2. `schema.prisma`:
   - **`Period`:** today's `PayrollPeriod` table, renamed. Drop `variationSubmittedAt`, `variationFilePath` and
     `closedAt`. Relations: deductions, paymentInflows, variations.
   - **`Organization`:** `id`, `name`, `normalizedName @unique`, `createdAt`. Relations: payrolls, variations.
   - **`CustomerPayroll`:** `organization String` becomes `organizationId` (FK, required).
   - **New `Variation`** as in P3.
   - **`Voucher`:** today's `PayrollUpload` renamed; `periodId` becomes `variationId @unique`. `Admin.payrollUploads`
     becomes `vouchers`; `PaymentInflow.uploadId` becomes `voucherId`.
   - **`Deduction`:** add `variationId String?` with `@@index([variationId, status])`.
   - **`MicroLoan`, `TenureChange`:** add `variationId String?` (set only by a lock's penalties and cap proposals,
     R6).
   - **`ChangeRequestKind`:** add `ORGANIZATION` (P12).
   - **Audit actions:** drop `VARIATION_SUBMITTED`, `VARIATION_REVERTED`, `PERIOD_CLOSED` and `PAYROLL_UPLOADED`; add
     `VARIATION_GENERATED`, `VOUCHER_UPLOADED`, `VOUCHER_REVERTED`, `NO_PAYROLL`, `NO_PAYROLL_REVERTED` and
     `ORGANIZATIONS_MERGED`.
   - **Audit entity types:** `PAYROLL_PERIOD` → `VARIATION` and `PAYROLL_UPLOAD` → `VOUCHER`; add `ORGANIZATION`.
3. One migration, written by hand and started from the read-only `prisma migrate diff --from-schema-datasource …
   --to-schema-datamodel … --script`, then applied with `prisma migrate deploy` (never `migrate dev`: see 0.1):
   1. It raises an error if any of these remain, because step 1 must have run:
      - a `PayrollUpload` row;
      - a month with `variationSubmittedAt` set;
      - an audit row with a dropped enum value.
   2. Rename `PayrollPeriod` → `Period`, keeping ids. The FKs from `Deduction`/`PaymentInflow` stay valid. **Also
      rename the constraints and indexes Prisma names after the table** (`PayrollPeriod_pkey`,
      `PayrollPeriod_year_month_key` → `Period_…`), or `migrate diff` reports drift. Drop the three old columns.
   3. Rename `PayrollUpload` → `Voucher` (empty) and `PaymentInflow.uploadId` → `voucherId`, with their
      constraints/indexes (`PayrollUpload_pkey`, `PayrollUpload_fileHash_key`, `PayrollUpload_uploadedById_fkey`,
      `PaymentInflow_uploadId_fkey`).
   4. Create `Organization` from the distinct normalized `CustomerPayroll.organization` (one, NPF, after step 1), keeping
      the most used spelling as `name`, and backfill `organizationId`.
   5. Create `Variation` (empty) and alter `Voucher`, `Deduction`, `MicroLoan` and `TenureChange`. Change the enums:
      add `ORGANIZATION` to `ChangeRequestKind`; for `AuditAction`/`AuditEntityType`, recreate the types (Postgres
      can't drop enum values; Prisma's generated SQL does this, and step 1 left no rows using the dropped values).
4. `invariants.sql` needs no change for the rename: `PaymentInflow_one_payroll_row_per_period` is on
   `PaymentInflow ("externalUserId", "periodId")`, not on the renamed table. Run it after the migration as usual.
5. `organizations.service.ts` (`findOrCreate(name, tx)`, `list`, `merge`), wired into the create paths in P2. Remove
   `organization` from the voucher's `payrollUpdate`.
6. `PeriodsService` works on `Period`: delete `openVariationPeriod`, `awaitingPayrollPeriod` and
   `firstUnsubmittedFrom`; add `firstOpenMonthFor(loan, tx)` (R1) and `variations.ensure(org, period, tx)`.
7. `scripts/maintenance/reset-customer-data.ts`: knows about `Period`, `Organization`, `Variation` and `Voucher`.
8. **Raw SQL names that typecheck can't see.** `"PayrollPeriod"` appears in `balances.ts` (`lastSent`),
   `periods.service.ts` (`ensure`), `repayment-rate.ts` and `variation.service.ts`; grep for `"PayrollPeriod"`,
   `"PayrollUpload"` and `"uploadId"` before calling the stage done. `balances.ts` and `periods.service.ts` survive
   Stage A, and would fail at runtime.
9. Typecheck. Fix compile errors only where the meaning hasn't changed. The files Stages B and C rewrite (variation,
   close, upload, the payroll queue and what reads their state) may still fail to compile at the end of Stage A; list
   them in the stage's status note.

**Done when:**
- step 1 ran with the printed check clean;
- the migration applied (`migrate deploy`), followed by `invariants.sql`;
- `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma`
  reports no difference (no drift from the hand-written SQL);
- the raw-SQL grep finds no old names, and the only typecheck errors are in the files left to Stages B and C.

## Stage B — Ledger: deductions and variations

**Status: done (2026-10-07).** `refreshOpen`/`openFirst` follow R1 through `PeriodsService.firstOpenMonthFor`; the
preview, versioned generate (a queue job per org, `variation:<orgId>:<ym>`) and draft live in `variation.service.ts` and
`src/admin/variations`. `period-close.service.ts` is gone; settling lives in `variation-lock.service.ts`. Specs:
`variation.spec.ts` and `variation.integration.spec.ts` (LEDGER_IT, every case in step 5).

1. `deductions.service.ts`: R1 in `refreshOpen` and at disbursement.
2. `variation.service.ts`:
   - `preview(orgId, period, filter)` (R2);
   - `generate` (R3, as a job);
   - `draft` (P10; the existing `generateVariationDraft` job now takes `organizationId`).

   Delete `submit`, `revert`, `revertBlocker` and `assertEarlierSubmitted`. `rowsFor` takes the org and the
   prior-within-org rule. Keep `variation.ts` pure; an empty row list still produces the header row (P6). The org name
   goes in the file name and the email.
3. Delete `period-close.service.ts`. Move its per-loan settle/penalty/cap code into `variation-lock.service.ts`
   (`settleVariation`), unchanged except for `variationId` tagging. Stage C calls it.
4. `balances.ts`: `lastSent` orders by `Period`.
5. Specs (pure + `LEDGER_IT=1`). Cover the R1 example end to end, plus:
   - prior counts only within the org;
   - a new version keeps the old file until lock;
   - unchanged loans are frozen but kept off the file;
   - all unchanged → header-only file;
   - an org with no deductions is skipped by "generate all";
   - November generated while October is generated but unlocked;
   - November refused while October has OPEN rows (never generated); allowed when October was skipped;
   - October refused once November exists;
   - two generations at once leave one version.

## Stage C — Voucher, no payroll, revert

**Status: done (2026-10-07).** `vouchers.service.ts` (+ `vouchers.controller.ts`, `no-payroll.controller.ts`), the
voucher job in `queue.repayments.ts`, and `noPayroll`, `revertNoPayroll`, `revertVoucher` and `rematch` in
`variation-lock.service.ts`. A voucher and No payroll refuse up front while the penalty rate isn't set. Specs:
`ledger.integration.spec.ts` (LEDGER_IT) covers step 5.

1. `payroll-upload.service.ts` → `vouchers.service.ts`: takes `organizationId`, plus the R4 guards. `validate` reports
   the variation and which rows would be issues. The refusal for earlier unlocked months lists them.
2. `queue.repayments.ts`: R4 steps 1–3, paying on `variationId`. Steps 2–3 run after the last row and are safe to
   re-run.
3. `repayments.service.ts` manual resolution: APPLY looks the deduction up through the inflow's voucher → variation,
   and rematches per R4b (the per-loan undo lives in `variation-lock.service.ts` next to `settleVariation`).
4. No payroll (R5) and revert (R6) in `variation-lock.service.ts`.
5. Specs (`LEDGER_IT=1`):
   - underpay → PARTIAL + penalty;
   - a staff member missing from the voucher → FAILED;
   - an UNMATCHED row: its borrower's deduction settles FAILED + penalty; rematching it clears the penalty and settles
     the deduction FULFILLED (or PARTIAL with a penalty on the rest); balances equal a voucher that matched first time,
     to the kobo;
   - rematching after a liquidation collected part of the penalty falls back: the loan is paid, the penalty stays;
   - OPEN(P+1) created and superseded files deleted;
   - a voucher with no variation is refused;
   - a November voucher while October is unlocked is refused and names October; No payroll on October penalizes
     everyone in it, then the November voucher goes in;
   - No payroll before the month ends is refused;
   - a second voucher, or a voucher after a no payroll, is refused;
   - a row from another org → REVIEWING;
   - revert (voucher and no payroll) restores balances to the kobo;
   - voucher revert refused once the month has ended, or once P+1 has a variation, or after a later liquidation;
   - no payroll revert allowed with P+1 generated, refused once P+1 has a voucher; then P's late voucher goes in;
   - re-running the job doesn't double-penalize.

## Stage D — Org switches, reads, routes, docs

**Status: done (2026-10-07), except step 6** (STOP rows in the old organization for a borrower who moved), which
can wait as planned. Beyond the steps:
- Merging is also refused when a month waiting for its voucher would sit behind a locked one, or when the loans'
  OPEN deductions would land in a month the merged organization has already generated (`mergeBlocker`).
- Approving an org switch moves each OPEN deduction of the borrower past the new organization's latest variation
  (`DeductionsService.rehomeOpen`): left in an earlier month, it could never be generated (P9) and would block the
  organization's next generation (R3).
- The customers overview's status counts read each organization's latest locked variation (R8).
- The smoke script runs in an organization of its own. It can't end a month on a real clock, so No payroll and the
  month after are only checked as refused before the month ends; the LEDGER_IT specs run them. It passed (2026-10-07)
  against a local API on a scratch database migrated to this schema.

1. Org switch change requests (P12). `change-requests.service.ts` gets the ORGANIZATION kind: any admin proposes one, or
   proposes in bulk from external ids, and a SUPER_ADMIN approves or rejects. The bulk call returns, per id: created /
   no such customer / already in that org / a request already pending.
2. Routes (log each one in `V2_API_CHANGES.md`):

   | Route | |
   | --- | --- |
   | `GET /admin/organizations` | Replaces `/admin/customers/organizations`. Each org with its latest locked month, its unlocked variations (version, updatedAt, regenerate hint) and whether it has deductions this month. |
   | `POST /admin/organizations/:id/merge` `{ intoId }` | SUPER_ADMIN. Moves payrolls. Refused if both orgs have a variation for the same month. |
   | `POST /admin/organizations/:id/switch-requests` `{ externalIds[] }` | Any admin. Proposes ORGANIZATION change requests into this org. Approved by a SUPER_ADMIN through `/admin/change-requests/:id/approve`. |
   | `GET /admin/variations?organizationId=&period=YYYY-MM` | Preview rows + variation state. Replaces `GET /admin/payroll-variations`. |
   | `POST /admin/variations/generate` `{ period, organizationIds[] \| all: true }` | SUPER_ADMIN. One job per org. Returns the queued org ids, the skipped ones (no deductions) and the ones refused, with the reason. |
   | `POST /admin/variations/draft` `{ period, organizationId }` | Emails the draft. |
   | `GET /admin/variations/:id/file` | Signed URL for the current version (`?version=` for an older one, while it's kept). |
   | `POST /admin/variations/:id/no-payroll` `{ reason }` / `DELETE` | SUPER_ADMIN. R5 / revert it (R6). |
   | `POST /admin/vouchers` (`organizationId`, file, `period?`), `POST /admin/vouchers/validate` | Replace `repayments/upload` and `validate`. Direct upload, as now. The 409 for earlier unlocked months lists them. |
   | `DELETE /admin/vouchers/:id` `{ reason }` | SUPER_ADMIN. Revert (R6). |
   | **Removed** | `payroll-variations/*`; `repayments/upload`, `/validate`, `/close-period`. |

3. `GET /admin/repayments/overview` (`repayments.service.ts`), dashboard, `repayment-rate.ts`, `customers.service.ts`
   (`getRepaymentStatusCounts`), `repayment.entity.ts` and `payroll-variation.dto.ts`: no more `closedAt` or
   `variationSubmittedAt` (R8). Customer filter by `organizationId`. `queue.maintenance.ts`
   (`handleVariationReminder`, "Submit the X variation") becomes a per-org reminder, sent to SUPER_ADMIN:
   - a month that has ended with OPEN deductions never generated;
   - a variation whose month has ended with no voucher (offer No payroll).

   The `AdminNotifierService` link `/dashboard?variation=open` follows the new frontend route.
4. V2.MD: §0.5 and §0.6 point to this file, and D10's `variationFilePath` mention is updated. Rewrite Stage 8 steps 3–4:
   - v1 repayment months become `Period` rows, and their deductions are settled with no variation;
   - prior-within-org (R2) counts a history row with no variation as the borrower's current org;
   - v1's last submitted variation month becomes one Variation per org, with its v1 file, so each org's first v2
     variation lists only real changes. How it is marked depends on the state at cutover:
     - **v1 already applied that month's repayments:** lock it (`noPayrollReason = 'Migrated from v1'`, no
       penalties run);
     - **it still waits for its file:** leave it unlocked, with its deductions AWAITING, so the real voucher can be
       uploaded in v2. Locking it would refuse that voucher.
5. Smoke script: disburse → generate → top-up → regenerate → voucher → revert → voucher again → next month generated,
   no voucher → No payroll → the month after.
6. *(Can wait, P12)* Org transfer: rows in the old org's preview list STOP for loans whose last sent deduction was there
   but whose borrower has moved.

## Stage E — Frontend (`apps/frontend`)

**Status: done (2026-10-07).** `/variations` (every org at a glance; one org's month with its history; generate,
download, draft, No payroll, merge), `ui/modals/upload-voucher` (org picker, validate, No payroll for an earlier month
then continue), revert on the repayments view, org switch (customer page) and bulk switch (customers list), audit
labels, the per-org dashboard rail. Typecheck and lint clean; not yet clicked through in a browser.

- Variations page (`src/lib/payroll/variations.ts`, `src/ui/modals/request-variation`):
  - org picker (one, or all) and month;
  - orgs with no deductions shown as skipped;
  - version and "last generated" (`updatedAt`), with the regenerate hint;
  - Generate, Download (current or an older version) and Email draft;
  - No payroll on an unlocked month that has ended;
  - no Submit or Revert.
- Vouchers (`src/lib/mutations/admin/repayments.ts`, `src/lib/queries/admin/repayment.ts`): an org picker plus the
  file. Before you confirm, it shows the variation it lands in and the rows that would be issues. When an earlier
  month is unlocked, it offers No payroll for it (reason dialog) and then continues. Issues show in the existing
  inflow review list. SUPER_ADMIN gets Revert (reason dialog) while it's allowed. No Close period button.
- Customer page and bulk tool: any admin requests an org switch (one customer, or a list of external ids); SUPER_ADMIN
  approves it in the change-requests view. The change-request types
  (`src/types/entities/admin/change-requests.d.ts`) gain the ORGANIZATION kind.
- Audit log (`src/ui/audit/audit-log-table.tsx`): labels for the new actions and entity types; the dropped ones go.
- Customer forms and filters use `GET /admin/organizations`.
- Dashboard: latest locked month per org.

## Risks to watch

- **Settlement doesn't wait for issues.** A borrower whose voucher row didn't match (a mistyped staff id, say) is
  FAILED and penalized when the voucher lands. Rematching clears that (R4b), unless a payment has already collected
  part of the penalty or its tenure change was decided. Then the penalty stays. Rematch issues promptly.
- **A voucher can't be added to once it's in.** A staff row that comes in after the voucher can't be added. It needs
  revert then upload again, which is only possible while the month is active and P+1 isn't generated (R6).
- **Generating P+1 before P's voucher lands means P's voucher can't be reverted** (R6), and P's penalties leave P+1's
  amounts stale until P+1 is regenerated (R3). If P+1 has already gone to the org, the difference rides into P+2.
- **Generating is now the freeze, during the month.** Between the last generation and the voucher, payroll works from
  the last file. Changes in that window ride in OPEN(P+1) and go out in the next variation, or are folded in if
  someone regenerates.
- **The wrong org picked on upload.** Every row becomes an issue (REVIEWING) and everyone in that org's variation is
  FAILED and penalized. `validate` shows the issue count before you confirm; a revert undoes it while R6 allows.
- **The reset (Stage A, step 1) deletes September's repayments** on the live database. Repaid goes down on those loans.
  That is the fresh start you asked for, but the printed before/after is the check that nothing else moved, and the
  JSON it saves is the way back.
- **The live v2 API is down from Stage A's migration until the merge deploys.** Keep the stages moving, or apply the
  migration only once Stages B and C compile.
