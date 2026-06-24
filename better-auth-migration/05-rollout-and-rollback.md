# 05 — Zero-Downtime Rollout & Rollback

The principle: **old and new auth run in parallel** until the new path is proven, then the old path is removed. No big-bang switch.

```
Phase 0  Backup + schema (additive)        ── no behaviour change
Phase 1  Deploy BA server (dormant)        ── /api/auth live, nobody uses it yet
Phase 2  Backfill data                     ── accounts + emailVerified populated
Phase 3  Dual-verify resource routes       ── old AND new JWTs accepted
Phase 4  Frontend cutover (flagged)        ── clients start using BA
Phase 5  Soak + monitor
Phase 6  Cleanup                           ── delete old auth, drop legacy column
```

---

## Phase 0 — Backup & additive schema
- `pg_dump "$DATABASE_URL" > backup_pre_ba.sql`.
- Deploy **M1** (file 01): new tables + `emailVerified` + `password` nullable. Purely additive — existing `/auth` flow keeps working. **No user impact.**
- ✅ Gate: app behaves identically; `SELECT` shows new empty tables.

## Phase 1 — Deploy Better Auth server (dormant)
- Ship `auth.ts` + `main.ts` mount (file 02). `/api/auth/*` is live but **no client calls it yet**.
- Verify `GET /api/auth/ok` → `{status:"ok"}` and `/api/auth/jwks` returns keys in prod.
- Resource routes still use the **old** `JwtStrategy` (HS256) at this point — don't deploy the new strategy yet.
- ✅ Gate: existing logins/tokens unaffected; BA health endpoints green.

## Phase 2 — Backfill
- Run the backfill script (file 01 §2): credential `account` rows + `emailVerified` (+ synthetic emails if chosen).
- Run the §3 verification queries — counts must match, zero stragglers.
- Manually test against staging: `POST /api/auth/sign-in/email` with a **real existing user's** email+password → expect a session + `authClient.token()` JWT. This proves bcrypt verification on a real legacy hash.
- ✅ Gate: a pre-existing prod-shaped user logs in through Better Auth with their **current** password.

## Phase 3 — Dual-verify resource routes
- Deploy the new `JwtStrategy` (file 03) **with the legacy fallback** (try JWKS, then `JWT_SECRET`). Now resource routes accept **both** token types.
- ✅ Gate: users holding old tokens still get 200s; a freshly minted BA JWT also gets 200s. Nobody is logged out.

## Phase 4 — Frontend cutover
- Ship the frontend changes (file 04) behind a flag if possible (e.g. `NEXT_PUBLIC_USE_BETTER_AUTH`), or as a single deploy during a low-traffic window.
- New logins now go through `authClient` and store BA JWTs. Existing sessions keep working via dual-verify until their old token expires (≤7 days) and they re-login into the new path.
- Roll out to internal/admin users first, then a canary %, then 100%.
- ✅ Gate: login, signup, verify, forgot/reset, logout, role-gated pages all work for both a brand-new user and a pre-existing user.

## Phase 5 — Soak
- Monitor for **at least one full old-token TTL (7 days)** so every active user has rotated onto a BA JWT.
- Watch (file 06 metrics): `/api/auth/*` error rate, resource-route 401 rate, login success rate, legacy-fallback hit count (instrument it — see below).
- ✅ Gate: legacy-fallback hits → ~0; 401 rate at or below pre-migration baseline.

## Phase 6 — Cleanup
Only after Phase 5 gate is green:
1. Remove the legacy fallback branch in `JwtStrategy`.
2. Delete `src/auth/auth.controller.ts` + the obsolete `AuthService` methods (keep `isValidUser`).
3. Remove `JwtModule.register`, `@nestjs/jwt`, `passport-jwt`, and `JWT_SECRET`.
4. Frontend: delete the old `/auth/*` mutations and the `verify-code` route.
5. Drop Redis `verify:*` / `reset:*` helpers if unused.
6. **M3 migration:** `ALTER TABLE "User" DROP COLUMN password;` (backup first — bcrypt hashes now live only in `Account`).
- ✅ Gate: full regression pass (file 06); legacy code/columns gone.

---

## Instrument the legacy fallback (so you know when it's safe to delete)

In the `JwtStrategy` catch branch, increment a counter/log line before verifying with `JWT_SECRET`:

```ts
catch {
  this.logger.warn("legacy_jwt_fallback_used"); // alert/dashboard on this
  payload = this.legacyJwt.verify(token);
}
```

When this hits zero for a sustained period (> old TTL), Phase 6 step 1 is safe.

---

## Rollback per phase

| Phase | Symptom | Rollback |
| --- | --- | --- |
| 0 | Migration error | Restore `backup_pre_ba.sql`; M1 is additive so usually just re-run |
| 1 | BA server 500s / boot fail | Revert `main.ts`+`auth.ts` deploy; tables remain harmless |
| 2 | Backfill mismatch | `DELETE FROM "Account" WHERE id LIKE 'cred-%'`; reset `emailVerified=false`; legacy `password` intact → old flow unaffected |
| 3 | New strategy breaks resource auth | Revert to old `JwtStrategy` deploy; old tokens still HS256-valid |
| 4 | Frontend auth broken | Flip `NEXT_PUBLIC_USE_BETTER_AUTH` off / revert FE deploy; dual-verify backend still accepts old tokens, so a reverted FE keeps working |
| 6 | Post-cleanup regression | Cleanup is the only **irreversible** phase (dropped column, deleted code) — do it last, behind a fresh backup, after a long soak |

**Key safety property:** through Phases 0–5 the legacy `User.password` column and the old `/auth` controller are intact, so a frontend revert at any point restores the original system completely.

---

## Pre-flight checklist before Phase 4 (the visible cutover)

- [ ] Phase 2 gate passed (real legacy user logs in via BA)
- [ ] Dual-verify deployed and confirmed (both token types → 200)
- [ ] Cross-subdomain cookie + CORS verified in prod (`Set-Cookie` domain `.microbuiltprime.com`, no CORS errors in console)
- [ ] Email deliverability checked (reset + verification emails actually arrive via Resend)
- [ ] Admin/SUPER_ADMIN role-gated routes verified with a BA JWT
- [ ] Rollback flag/deploy ready
