# Pending updates (need backend work)

## 1. Loan Summary: replace "Active Loans / Pending Loans"
A customer has at most one running loan, so "Active Loans: 1" says little, and "Pending Loans" mixes loan requests, asset
requests and top-ups. Suggested tiles (all already derivable from the ledger), in `GET /admin/customer/:id/summary`:

| Tile | Source |
| --- | --- |
| Monthly deduction | the OPEN deduction's `expected` (what payroll is asked for next) |
| Months left | `remainingMonths` of the running loan |
| Next deduction month | the OPEN deduction's period |
| Open requests | count of PENDING/APPROVED loans + IN_REVIEW asset requests + PENDING/APPROVED top-ups (split by kind in a tooltip) |

Keep `outstanding`, `totalBorrowed`, `totalRepaid`, `penaltyCharged`. Drop `activeLoansCount` / `pendingLoansCount` from
the card (the API can keep them for compatibility).

## 2. Loan Applications: open top-ups
`GET /admin/customer/:id/loans` already returns PENDING/APPROVED top-ups (`recordType: "TOPUP"`); the card now labels
them and links to their loan. If some still don't appear, check the top-up's MicroLoan status. Suggested: give
top-ups their own details endpoint (`GET /admin/loans/topups/:id`) so the card opens the top-up, not the whole loan.

## 3. Customer Repayments page
- Replace "New Loan Request" with "Request Liquidation" (the customer liquidation sheet already exists:
  `ui/liquidation/customer-liquidation-sheet.tsx`); disable it without a running loan.
- Merge Deductions, Inflows and Repayments into tabs like the admin page. Needs customer-scoped endpoints:
  `GET /user/deductions`, `GET /user/inflows` (PAYROLL / LIQUIDATION / IMPORT, own rows only) and
  `GET /user/repayments/applied`, reusing `RepaymentsService.listDeductions/list/listApplied` with `customerId` forced
  to the signed-in user (no customer column, no admin fields such as staff ID or upload ref).

## 4. Imported loans with inconsistent TOTAL (data)
UBA PETER (`LN-KZ77K0`) and APE BEGE (`LN-VP26EF`) were imported with TOTAL ≈ principal × 1.72, which matches a
12-month term at 6%, while TENURE said 3 and 4 months. The importer books TOTAL as given. Decide which is right:
- If the TOTAL is right: nothing to change on the money; the TENURE cell was the months left or a typo.
- If the TENURE is right: interest must be re-booked (a ledger correction, not a UI change).
Suggested guard: warn in the import summary when TOTAL differs from principal × (1 + rate × tenure) by more than 1%.

## 5. Prisma 7
The editor's Prisma extension is on 7 (rejects `url` in the schema), the CLI on 6.19 (requires it). Pin the extension
to Prisma 6 for now; upgrade as its own task (url → `prisma.config.ts`, `prisma-client` generator with
`moduleFormat = "cjs"`, `@prisma/adapter-pg` in `PrismaService`, `@prisma/client` imports, Jest mocks, better-auth's
Prisma adapter).
