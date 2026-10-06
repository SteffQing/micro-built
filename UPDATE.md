# Pending updates

## 1. Prisma 7
The editor's Prisma extension is on 7 (rejects `url` in the schema), the CLI on 6.19 (requires it). Pin the extension
to Prisma 6 for now; upgrade as its own task (url → `prisma.config.ts`, `prisma-client` generator with
`moduleFormat = "cjs"`, `@prisma/adapter-pg` in `PrismaService`, `@prisma/client` imports, Jest mocks, better-auth's
Prisma adapter).

## 2. Browser checks still owed
Built and typechecked, not yet clicked through:
- Customer settings: submit an identity / bank change, see the live values stay with the "waiting for approval"
  notice; approve or reject it as an admin and see it land in "Recent changes" (with the rejection reason).
- Customer page (admin): the pending-change notice links to `/approvals?request=<id>`.
- Customer Repayments: Deductions / Payments received / Repayments tabs; "Request Liquidation" disabled without a
  running loan.
- Customer Loan Applications: a top-up's "See top-up" opens it with approve / reject / disburse.
