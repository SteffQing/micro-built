# MicroBuilt Frontend — Bug Report

> Bugs, logic errors, missing integrations, and UI issues found during top-down code review.  
> Severity: **Critical** → **High** → **Medium** → **Low**

---

## Critical

### BUG-001 — `updateCashLoan` and `deleteCashLoan` swallow query invalidation
**File:** `src/lib/mutations/user/loans.ts` — lines 30–35, 45–50  
**Problem:** `Promise.all()` is called but its result is not returned inside `onSuccess`. React Query treats `onSuccess` as completed before the queries are invalidated or the toast fires. The UI may show stale loan data after an edit/delete.

```ts
// Current (broken)
onSuccess: (data) => {
  Promise.all([
    queryClient.invalidateQueries({ queryKey: [base] }),
    queryClient.invalidateQueries({ queryKey: [base, id] }),
  ]).then(() => toast.success(data));
},

// Fix — add return
onSuccess: (data) => {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [base] }),
    queryClient.invalidateQueries({ queryKey: [base, id] }),
  ]).then(() => toast.success(data));
},
```

---

### BUG-002 — `LoanCategory` enum mismatch with API spec
**File:** `src/types/enums.d.ts`  
**Problem:** The frontend enum includes categories the backend does not define, which will produce a `400 Bad Request` if selected.

| Frontend enum value | In API spec? |
|---------------------|-------------|
| `PERSONAL` | Yes |
| `BUSINESS` | Yes |
| `EDUCATION` | Yes |
| `MEDICAL` | Yes |
| `UTILITIES` | Yes |
| `ASSET_PURCHASE` | Yes (internal for commodity) |
| `RENT` | **No** |
| `TRAVEL` | **No** |
| `AGRICULTURE` | **No** |
| `EMERGENCY` | **No** |
| `OTHERS` | **No** |

**Fix:** Remove `RENT`, `TRAVEL`, `AGRICULTURE`, `EMERGENCY`, `OTHERS` from the `LoanCategory` type and all select inputs.

---

### BUG-003 — `Gender` enum missing `Other` option
**File:** `src/types/enums.d.ts`  
**Problem:** The API spec defines `Male | Female | Other` but the frontend type only has `"Female" | "Male"`. Sending `Other` would fail validation; it's also not shown in the identity form.

**Fix:** Add `"Other"` to the `Gender` type and update all gender select fields.

---

## High

### BUG-004 — Identity create (`POST /user/identity`) not implemented — only update (`PATCH`) exists
**File:** `src/lib/mutations/user/index.ts` — `updateIdentity`  
**Problem:** The mutation always calls `PATCH /user/identity`. For a first-time user who has never submitted identity info, the backend returns `400` because the record doesn't exist yet (it expects `POST`). The UI has no way to distinguish create vs update.

**Fix:** Check if identity data is `null` when fetched, and call `POST /user/identity` on first submit, `PATCH` on subsequent edits.

---

### BUG-005 — User payroll mutations entirely missing
**Files:** No file found under `src/lib/mutations/user/` for payroll  
**Problem:** `POST /user/payroll` and `PATCH /user/payroll` are API endpoints that have no corresponding mutations or UI. The settings page shows payroll data read-only and the add-customer admin form has payroll fields, but customers cannot manage their own payroll.

---

### BUG-006 — User payment method create/update mutations missing
**Files:** No file found under `src/lib/mutations/user/` for payment-method  
**Problem:** `POST /user/payment-method` and `PATCH /user/payment-method` exist in the API but are not integrated. The settings Payment Method tab is fully read-only with no update form, and the note says users must "contact support" — but the API supports self-service updates.

---

### BUG-007 — `addComodity` and `deleteCommodity` share the same mutation key
**File:** `src/lib/mutations/admin/superadmin.ts` — lines 35, 44  
**Problem:** Both mutations declare `mutationKey: [base, "commodities"]`. React Query uses the mutation key for deduplication and tracking. If both run simultaneously or the key is used for state lookups they will conflict.

**Fix:** Give them distinct keys, e.g. `[base, "commodities", "add"]` and `[base, "commodities", "delete"]`.

---

### BUG-008 — `PATCH /admin/repayments/:id/manual-resolution` not implemented
**File:** No mutation exists for this endpoint  
**Problem:** The admin repayments table has no UI for manually resolving `MANUAL_RESOLUTION` status repayments. These rows cannot be actioned from the frontend at all.

---

## Medium

### BUG-009 — MARKETER dashboard is an empty fragment
**File:** `src/app/(protected)/dashboard/page.tsx` — line 21  
**Problem:** `userRole === "MARKETER"` renders `<></>`. Marketers land on a blank dashboard page with no content or navigation. This is a broken user experience.

---

### BUG-010 — Loan request page shows typo placeholder for admins
**File:** `src/app/(protected)/loan-request/page.tsx`  
**Problem:** When an admin visits `/loan-request` a message reads "No admin page for **loare**quest" — both a typo ("loarequest" instead of "loan-request") and an unfinished state.

---

### BUG-011 — `addComodity` mutation name is a spelling typo
**File:** `src/lib/mutations/admin/superadmin.ts` — line 35  
**Problem:** Function is named `addComodity` (missing one 'm'). Minor but inconsistent with `deleteCommodity` on line 44.

---

### BUG-012 — `LiquidationStatus` type missing `REVEIWING` state
**File:** `src/types/enums.d.ts`  
**Problem:** The API spec documents `REVEIWING` (intentional typo in the DB enum — must be used exactly as spelled). The frontend type should include this value so filter/display logic handles it correctly.

**Fix:** Add `"REVEIWING"` to `LiquidationStatus`.

---

### BUG-013 — Reset password form shows "securd" typo
**File:** `src/ui/auth/forgot-password/reset-password-form.tsx` — line 84  
**Problem:** Error message reads "Enter a securd password" instead of "Enter a secure password".

---

### BUG-014 — Reset password token has no empty-state gate
**File:** `src/ui/auth/forgot-password/reset-password-form.tsx` — line 57 + 96  
**Problem:** If the URL has no `token` query param, an error alert is shown but the form is still fully rendered underneath. The user sees a broken UI instead of a clean redirect.

**Fix:** Return early with a redirect to `/forgot-password` if no token is present.

---

### BUG-015 — `POST /admin/repayments/validate` not implemented
**Problem:** The API has a dedicated endpoint to validate an IPPIS Excel file without processing it. The upload modal goes straight to upload with no pre-flight validation, which means users only discover malformed files after a failed upload.

---

### BUG-016 — `GET /user/loan/all` (combined loans endpoint) not used
**File:** No query in `src/lib/queries/user/loan.ts` for `/user/loan/all`  
**Problem:** The API provides a combined paginated endpoint for cash + commodity loans sorted by date. The frontend fetches them separately. The customer dashboard/loan list could use this unified endpoint instead.

---

## Low

### BUG-017 — Support email has a typo
**File:** `src/ui/settings/user-settings-view/identity/` (identity components)  
**Problem:** A hardcoded email reads "onboard@**miocro**built.com" — should be "onboard@microbuilt.com".

---

### BUG-018 — `addComodity` / `deleteCommodity` query key uses `"/admin/"` prefix inconsistently
**File:** `src/lib/mutations/admin/superadmin.ts` — `inviteAdmin` line 8  
**Problem:** `inviteAdmin` invalidates `{ queryKey: ["/admin"] }` but the query is registered under `["admins"]` in `src/lib/queries/admin/superadmin.ts` line 14. The invalidation does nothing.

**Fix:** Align the invalidation key: `queryClient.invalidateQueries({ queryKey: ["admins"] })`.

---

### BUG-019 — `removeAdmin` has the same invalidation key mismatch
**File:** `src/lib/mutations/admin/superadmin.ts` — line 23  
**Problem:** Same issue as BUG-018. `removeAdmin` invalidates `{ queryKey: ["/admin"] }` instead of `["admins"]`.

---

### BUG-020 — Hardcoded button styles in auth forms override design system
**Files:**
- `src/ui/auth/sign-up/verify-otp-form.tsx` — line ~121
- `src/ui/auth/forgot-password/request-reset-form.tsx` — line ~99

**Problem:** Some buttons use hardcoded Tailwind classes (`bg-gray-200 hover:bg-gray-300 text-gray-700`) instead of the `variant="secondary"` prop from the Button component. This will break in dark mode and doesn't follow the design system.

---

## Summary Table

| ID | Severity | Area | One-line description |
|----|----------|------|----------------------|
| BUG-001 | Critical | Mutations | `updateCashLoan`/`deleteCashLoan` don't return Promise, invalidation is fire-and-forget |
| BUG-002 | Critical | Types/Validation | 5 `LoanCategory` values don't exist in API spec — will 400 |
| BUG-003 | Critical | Types/Validation | `Gender` missing `Other` option from API spec |
| BUG-004 | High | Settings | Identity create (`POST`) not handled — always sends PATCH, fails for new users |
| BUG-005 | High | Settings | No user payroll mutations (POST/PATCH) |
| BUG-006 | High | Settings | No user payment method mutations (POST/PATCH) |
| BUG-007 | High | Mutations | `addComodity` and `deleteCommodity` share mutation key |
| BUG-008 | High | Repayments | Manual resolution endpoint not implemented |
| BUG-009 | Medium | Dashboard | MARKETER dashboard is blank |
| BUG-010 | Medium | Loans | Admin loan-request page shows typo placeholder |
| BUG-011 | Medium | Mutations | `addComodity` spelling typo |
| BUG-012 | Medium | Types | `LiquidationStatus` missing `REVEIWING` state |
| BUG-013 | Medium | Auth | Typo "securd" in reset password error message |
| BUG-014 | Medium | Auth | No redirect/gate when reset-password token is missing |
| BUG-015 | Medium | Repayments | Validate repayment file endpoint not integrated |
| BUG-016 | Medium | Loans | `GET /user/loan/all` combined endpoint not used |
| BUG-017 | Low | Settings | Hardcoded support email has typo ("miocrobuilt") |
| BUG-018 | Low | Mutations | `inviteAdmin` invalidates wrong query key |
| BUG-019 | Low | Mutations | `removeAdmin` invalidates wrong query key |
| BUG-020 | Low | Auth | Hardcoded button styles in auth forms override design system |
