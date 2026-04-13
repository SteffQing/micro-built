# MicroBuilt — Remaining Integration Spec

> Covers only the API endpoints and UI flows that are **not yet integrated** as of the current codebase review.  
> For full API details see `FRONTEND_INTEGRATION_SPECS.md`. For existing flow documentation see `APP_FLOW.md`.

---

## 1. User — Identity (Create)

**What's missing:** `POST /user/identity` — the initial submission for a user who has never provided identity data.  
**What exists:** Only `PATCH /user/identity` (update) is implemented.

### Endpoint

```
POST /user/identity
```

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
| `nextOfKinRelationship` | enum | yes | `Sibling \| Parent \| Spouse \| Child \| Grandparent \| Other` |
| `gender` | enum | yes | `Male \| Female \| Other` |
| `maritalStatus` | enum | yes | `Single \| Married \| Divorced \| Widowed` |

**Response `201`:**
```json
{ "data": null, "message": "Your identity documents have been successfully created! Please wait as we manually review this information" }
```

**Error:** `400` if identity already exists (user should be taken to PATCH flow instead).

### Integration Notes

- The Settings > Identity tab must check if `GET /user/identity` returns `null` on load.
- If `null` → form submit calls `POST /user/identity`.
- If data exists → form submit calls `PATCH /user/identity`.
- The existing `updateIdentity` mutation in `src/lib/mutations/user/index.ts` only handles PATCH. Add a `createIdentity` mutation alongside it.
- Update the `Gender` type in `src/types/enums.d.ts` to include `"Other"`.

---

## 2. User — Payroll

**What's missing:** Full payroll management — no mutations exist under `src/lib/mutations/user/`.  
**What exists:** `GET /user/payroll` query is implemented (read-only display).

### Endpoints

#### `POST /user/payroll` — Create

```
POST /user/payroll
```

**Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `externalId` | string | yes | IPPIS staff ID — must exist in platform records |
| `grade` | string | no | |
| `step` | number | no | |
| `command` | string | yes | |
| `organization` | string | yes | |

**Response `201`:**
```json
{ "data": null, "message": "User payroll data created" }
```

**Error:** `404` if IPPIS ID not found.

#### `PATCH /user/payroll` — Update

```
PATCH /user/payroll
```

All fields optional except `externalId` is **excluded** (cannot be changed after creation).

**Response `200`:**
```json
{ "data": null, "message": "User payroll data updated" }
```

### Integration Notes

- Add a Payroll tab (or expand Identity tab) in `UserSettingsPage`.
- Same create-vs-update pattern as identity: check if payroll data is `null` on load.
- If `null` → show full form (all fields including `externalId`) → `POST /user/payroll`.
- If data exists → show edit form (exclude `externalId`, show it read-only) → `PATCH /user/payroll`.
- Create `src/lib/mutations/user/payroll.ts` with `createPayroll` and `updatePayroll` mutation options.

---

## 3. User — Payment Method (Create & Update)

**What's missing:** `POST /user/payment-method` and `PATCH /user/payment-method`.  
**What exists:** `GET /user/payment-method` query is implemented. The Settings > Payment Method tab is read-only.

### Endpoints

#### `POST /user/payment-method` — Create

```
POST /user/payment-method
```

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

**Errors:** `409` already exists · `422` account name mismatch.

#### `PATCH /user/payment-method` — Update

```
PATCH /user/payment-method
```

All fields optional. `bvn` likely read-only after creation — confirm with backend.

**Response `200`:**
```json
{ "data": null, "message": "Payment method has been successfully updated." }
```

### Integration Notes

- Remove the "contact support" placeholder copy from the Payment Method tab.
- Add an edit form with the same create-vs-update pattern.
- `bvn` field should use a password-type input or be masked for display.
- Add form field: `bvn` (11 digits, required only on create).
- Create `src/lib/mutations/user/paymentMethod.ts` with `createPaymentMethod` and `updatePaymentMethod`.
- Invalidate the `["/user/", "payment-method"]` query key on success.

---

## 4. Admin — Repayments: Manual Resolution

**What's missing:** `PATCH /admin/repayments/:id/manual-resolution`  
**What exists:** No mutation or UI for this action. Repayments in `MANUAL_RESOLUTION` status cannot be actioned from the frontend.

### Endpoint

```
PATCH /admin/repayments/:id/manual-resolution
```

**Body:**

| Field | Type | Required | Condition |
|-------|------|----------|-----------|
| `resolutionNote` | string | yes | Always required |
| `userId` | string | conditional | Required when IPPIS ID in upload didn't match any user |
| `loanId` | string | conditional | Required when repayment is an overflow (user exists but no loan match) |

**Response `200`:**
```json
{ "data": null, "message": "Repayment status has been manually resolved!" }
```

### Two Resolution Scenarios

The UI must distinguish between the two `MANUAL_RESOLUTION` sub-types visible in the repayment detail:

1. **Unknown user** — IPPIS ID in the uploaded file matched no customer. Admin must search for and select a customer (`userId`) to link the repayment.
2. **Overflow** — Customer paid more than owed; excess is unlinked. Admin must select which loan (`loanId`) to apply it to.

### Integration Notes

- In the Admin Repayments table, rows with `status === "MANUAL_RESOLUTION"` need a "Resolve" action button.
- Open a modal with:
  - `resolutionNote` textarea (required)
  - Conditional `userId` search input (shown when no linked user on the repayment)
  - Conditional `loanId` search input (shown when linked user exists but no loan)
- Add `manualResolution(id)` mutation to `src/lib/mutations/admin/repayments.ts`.
- Invalidate `["/admin/repayments/", id]` and the repayments list on success.

---

## 5. Admin — Repayments: Validate File

**What's missing:** `POST /admin/repayments/validate`  
**What exists:** The upload flow goes straight to `POST /admin/repayments/upload` with no pre-flight check.

### Endpoint

```
POST /admin/repayments/validate
```

**Body:** `multipart/form-data`

| Field | Notes |
|-------|-------|
| `file` | Excel `.xlsx` / `.xls`; max 10 MB |

**Response `200`:**
```json
{
  "data": {
    "headers": { "valid": true, "missing": [] },
    "rows": { "valid": true, "issues": [] }
  }
}
```

### Integration Notes

- Add a validation step to the upload repayment modal (before the upload button becomes active):
  1. User selects file → immediately call `POST /admin/repayments/validate`.
  2. Show validation result inline: green checkmark if valid, red list of `missing` headers or `issues`.
  3. Only enable the "Upload" button once validation passes.
- Add `validateRepaymentFile` mutation to `src/lib/mutations/admin/repayments.ts`.
- This is a stateless check (no query invalidation needed on success).

---

## 6. MARKETER Dashboard

**What's missing:** A dashboard view for the `MARKETER` role.  
**What exists:** `<></>` (empty fragment) in `src/app/(protected)/dashboard/page.tsx` line 21.

### Suggested View

Based on available API endpoints accessible to MARKETER role:

- **My Customers** — `GET /admin/account-officer/me` (marketer's assigned customers, same filter params as customer list)
- **Overview stats** — `GET /admin/customers/overview`

### Integration Notes

- Create `src/ui/dashboard/marketer-dashboard/index.tsx`.
- Render it in `dashboard/page.tsx` when `userRole === "MARKETER"`.
- The marketer dashboard should show a summary card for their assigned customers and a quick link to `/customers`.

---

## 7. Combined User Loan List

**What's missing:** Integration of `GET /user/loan/all`  
**What exists:** Cash and commodity loans are fetched separately.

### Endpoint

```
GET /user/loan/all
```

**Query:**

| Param | Type | Default |
|-------|------|---------|
| `page` | number | 1 |
| `limit` | number | 10 |

**Response:** Paginated list of cash and commodity loans combined, sorted by date descending.

### Integration Notes

- Consider replacing the separate loan queries in `UserDashboardPage` with this unified endpoint for a simpler "All Loans" view.
- Add a query to `src/lib/queries/user/loan.ts`.

---

## 8. Enum Corrections Required Before Any New Integration

The following enum mismatches (see BUGS.md BUG-002, BUG-003, BUG-012) must be fixed first as they affect forms across the app:

### `LoanCategory` — Remove non-spec values

**File:** `src/types/enums.d.ts`

Remove: `RENT`, `TRAVEL`, `AGRICULTURE`, `EMERGENCY`, `OTHERS`  
Keep: `PERSONAL`, `BUSINESS`, `EDUCATION`, `MEDICAL`, `UTILITIES`, `ASSET_PURCHASE`

### `Gender` — Add `Other`

**File:** `src/types/enums.d.ts`

Add: `"Other"` to the `Gender` type.

### `LiquidationStatus` — Add `REVEIWING`

**File:** `src/types/enums.d.ts`

Add: `"REVEIWING"` (intentional DB typo — must match exactly).

---

## Checklist

- [ ] `POST /user/identity` — create mutation + conditional form logic
- [ ] `POST /user/payroll` — create mutation + form tab in user settings
- [ ] `PATCH /user/payroll` — update mutation + edit mode
- [ ] `POST /user/payment-method` — create mutation + form (remove "contact support" copy)
- [ ] `PATCH /user/payment-method` — update mutation + edit mode
- [ ] `PATCH /admin/repayments/:id/manual-resolution` — mutation + resolve modal with both sub-type flows
- [ ] `POST /admin/repayments/validate` — mutation + pre-upload validation step in upload modal
- [ ] MARKETER dashboard — `MarketerDashboardPage` component + wire into `dashboard/page.tsx`
- [ ] `GET /user/loan/all` — query option in `lib/queries/user/loan.ts`
- [ ] Fix `LoanCategory` enum (remove 5 invalid values)
- [ ] Fix `Gender` enum (add `Other`)
- [ ] Fix `LiquidationStatus` enum (add `REVEIWING`)
