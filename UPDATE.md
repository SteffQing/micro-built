# Pending updates

## 1. Prisma 7
The editor's Prisma extension is on 7 (rejects `url` in the schema), the CLI on 6.19 (requires it). Pin the extension
to Prisma 6 for now; upgrade as its own task (url → `prisma.config.ts`, `prisma-client` generator with
`moduleFormat = "cjs"`, `@prisma/adapter-pg` in `PrismaService`, `@prisma/client` imports, Jest mocks, better-auth's
Prisma adapter).

## 2. Encrypt BVNs at rest
The API now sends a BVN only to super admins, but `CustomerPaymentMethod.bvn` is still plain text in the database.
Encrypt it (application-level, a key outside the database) and keep a separate keyed hash for the uniqueness check
and the "this BVN belongs to another customer" lookups, which can't run on ciphertext.

## 3. Browser checks still owed
Built and typechecked, not yet clicked through:
- Confirmations: disburse, upload payroll, generate and revert a variation, close a month, accept a liquidation and
  approve a bank-details change each ask "Confirm it's you" (code or passkey) and go through after it; rates,
  maintenance and admin management ask once per ten minutes. Closing the dialog cancels quietly.
- An admin with neither 2FA nor a passkey gets the "Set up 2FA or a passkey" prompt on a gated action.
- Admins add a passkey under Settings → 2FA & Passkeys and sign in with it; a super admin with only a passkey is
  refused a password-only sign-in.
- Admin management → Manage: change a role, reset sign-in, remove. Customer page: Reset sign-in (super admins).
- A plain admin sees no BVN on the customer page or in an approval; a super admin does.
- Customer settings: submit an identity / bank change, see the live values stay with the "waiting for approval"
  notice; approve or reject it as an admin and see it land in "Recent changes" (with the rejection reason).
- Customer page (admin): the pending-change notice links to `/approvals?request=<id>`.
- Customer Repayments: Deductions / Payments received / Repayments tabs; "Request Liquidation" disabled without a
  running loan.
- Customer Loan Applications: a top-up's "See top-up" opens it with approve / reject / disburse.
