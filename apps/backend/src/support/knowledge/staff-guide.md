# Staff guide

Where things are in the app. Each section is loaded for its role and the roles above it (marketer < admin < super
admin).

<!-- role: MARKETER -->
## Marketers

- **Customers** (`/customers`): your own customers only (the ones you are account officer for). Search by name, email,
  phone or IPPIS number; open a customer for their loans, repayments, statement and details.
- **Adding a customer:** **Customers → Add customer** (`/customers/add-customer`). A customer you add starts flagged
  until an admin checks their details.
- **Loans** (`/loans`): your customers' loan requests, asset requests and top-ups. You can escalate one to the admins
  when it has waited too long for a decision or a payout.
- **Top-ups:** request one from the customer's page while their loan is running; the admins approve and pay it out.
- **Repayments** (`/repayments`): your customers' monthly deductions and their status (fulfilled, partial, failed).

<!-- role: ADMIN -->
## Admins

- **Approvals** (`/approvals`): change requests (profile, identity, bank account, payroll, organization switches). An
  organization switch is approved by a super admin.
- **Customers** (`/customers`): every customer. On a customer's page: flag or activate them, message them, request a
  liquidation for them, generate a report, request a top-up, propose a tenure change, and change their account officer.
- **Cash loans** (`/loans/cash`) and **Asset loans** (`/loans/commodity`): approve or reject requests (approving sets the
  tenure). Disbursing is a super admin's.
- **Top-ups** (`/loans/topups`) and **Tenure changes** (`/loans/tenure-changes`): approve or reject them.
- **Repayments** (`/repayments`):
  - *Deductions:* each month's expected and collected amounts per borrower.
  - *Inflows:* payments received. Rows a voucher couldn't match wait in review: apply them to a loan, settle them, or
    reject them.
  - *Liquidations:* check the proof of an early payment, then accept or reject it.
- **Variations** (`/variations`): per organization and month, preview what payroll will be asked to change, download a
  generated variation, and email a draft.
  - A variation is a **change list, not the full list** of deductions. It holds only three kinds of row: **START** (a
    loan whose deduction begins), **AMEND** (the monthly amount changed, e.g. after a top-up or a tenure change) and
    **STOP** (the deduction ends: repaid, liquidated, or the borrower moved to another organization).
  - A loan whose monthly amount is the same as the last one payroll was sent is **not on the file**: payroll keeps
    deducting the amount it already has. Never say unchanged deductions are listed in it.
  - Generating still freezes every deduction of the organization for that month, unchanged ones included, so the
    voucher can settle them all.
- **Commodities** (`/commodities`): the asset catalogue: add items, and activate or deactivate them.
- **Organizations** (`/organizations`): the employers whose payroll deducts.
- **Account officers** (`/account-officers`): each marketer's customers and stats.
- **Notifications:** prompts for things waiting on you (a change request, a liquidation, a support conversation) clear
  for everyone once one admin acts on them.
- **Support inbox** (`/support-inbox`): conversations customers, marketers and visitors passed to the team. Claim one,
  reply in the thread, and close it when it's done.

<!-- role: SUPER_ADMIN -->
## Super admins

- **Variations** (`/variations`):
  - *Generate* a month's variation for one organization, or **Generate for all**. Variations go in month order.
  - *Upload voucher:* payroll's record of what it deducted. Validate it first: it shows the rows that would need review.
    A voucher locks its month.
  - *No payroll:* when a month has ended and no voucher will come, mark it No payroll (with a reason). Everyone in it is
    then charged for the missed deduction. It can be reverted.
  - *Revert voucher:* undo a voucher (with a reason) while the app allows it, for example when the wrong file was
    uploaded.
  - Merge a misspelled organization into the right one from its page.
- **Disbursing:** pay out approved loans and top-ups from **Cash loans** and **Top-ups**.
- **Customers → Upload existing:** import existing customers and loans from a spreadsheet.
- **Settings** (`/settings`): the general settings (rates, maintenance mode), and **Admin management** to invite or
  remove admins and change their roles.
- **Audit log** (`/audit`): who did what, and when.
- **Callouts** (`/callouts`): the short cards at the foot of customers' sidebars (marketers and staff don't see them).
- **Support analytics:** the Analytics tab of the Support inbox.
- Super admins sign in with a passkey, or a password and two-factor authentication.
