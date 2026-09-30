# 06 — Testing Checklist & Env Reference

## A. Environment variables

### Backend (`micro-built`)
| Var | Value | Notes |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | ≥32 chars, **new** |
| `BETTER_AUTH_URL` | `https://api.microbuiltprime.com` | API host; `http://localhost:3003` in dev |
| `DATABASE_URL` | (existing) | shared Postgres |
| `JWT_SECRET` | (existing) | **keep until Phase 6**, then delete |
| Resend / Redis / Supabase | (existing) | unchanged |

### Frontend (`micro-built-frontend`)
| Var | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://api.microbuiltprime.com` | matches backend `BETTER_AUTH_URL` |
| `NEXT_PUBLIC_DEV` | (existing) | drives axios baseUrl |

---

## B. Backend functional tests

- [ ] `GET /api/auth/ok` → `{ "status": "ok" }`
- [ ] `GET /api/auth/jwks` → `{ keys: [...] }`
- [ ] `POST /api/auth/sign-up/email` (email user) → user row with `MB-…` id, `status=INACTIVE`, `emailVerified=false`; verification email sent
- [ ] Sign-up (synthetic-email/contact user) → `status=FLAGGED`, `emailVerified=true`, no email
- [ ] `POST /api/auth/sign-in/email` with a **pre-existing** legacy user's real password → success (proves bcrypt verify on legacy hash)
- [ ] Sign-in with wrong password → 401
- [ ] Sign-in with `INACTIVE` user → blocked by `requireEmailVerification`
- [ ] `authClient.token()` / `GET /api/auth/token` → JWT with `{ sub, role, email, contact }`
- [ ] JWT against `GET /user` → 200; `req.user.role` equals DB role
- [ ] Demote a user in DB, reuse old JWT → `RolesGuard` denies immediately (live re-fetch works)
- [ ] Ban (`status=INACTIVE`) a user, reuse JWT → 401 (`isValidUser` throws)
- [ ] Forgot password → reset email arrives → `resetPassword({token})` → can log in with new password
- [ ] Email verification link → `verifyEmail` flips `emailVerified=true` / `status` past INACTIVE
- [ ] Dual-verify window: an **old HS256** token still authorizes `/user` (until Phase 6)

## C. Authorization matrix (run with BA JWTs)

| Route sample | CUSTOMER | MARKETER | ADMIN | SUPER_ADMIN |
| --- | --- | --- | --- | --- |
| `GET /user` | ✅ | ✅ | ✅ | ✅ |
| `src/admin/customers` `@Roles(...)` | ❌ | per decorator | ✅ | ✅ |
| `src/admin/dashboard` | ❌ | per decorator | ✅ | ✅ |

Confirm each guarded controller's `@Roles(...)` still resolves correctly — behaviour must be **identical** to pre-migration.

## D. Frontend E2E (happy + edge)

- [ ] Login (email tab) → dashboard; JWT stored under `userAuthority`
- [ ] Login (mobile tab) → synthetic email path → dashboard
- [ ] Wrong credentials → toast error, no redirect
- [ ] Signup (email) → verification prompt; (contact) → straight to login
- [ ] Forgot → email → reset → login
- [ ] Logout → `signOut` clears session + token → `/login`; back-button doesn't re-enter protected pages
- [ ] Visiting a protected route while logged out → redirect `/login` (auth-provider gate)
- [ ] Visiting `/login` while logged in → redirect `/dashboard`
- [ ] Token expiry (if short-lived JWT): 401 → silent `refreshAccessToken` → request retried, no logout
- [ ] Session expiry: refresh fails → redirect `/login`
- [ ] No CORS errors; `Set-Cookie` domain is `.microbuiltprime.com`, `Secure`

## E. Security checks

- [ ] `role`/`status` are `input:false` — a crafted sign-up body cannot set them
- [ ] CORS origin is an explicit allowlist with `credentials:true` (never `*`)
- [ ] `useSecureCookies:true` in prod; cookies `HttpOnly`+`Secure`
- [ ] JWT verified against JWKS with `issuer` checked
- [ ] Rate limiting considered on `/api/auth/*` (Better Auth `rateLimit` — enable if not already)
- [ ] `BETTER_AUTH_SECRET` not committed; rotating it invalidates sessions (plan for it)

## F. Regression / load

- [ ] Existing non-auth flows (loans, repayments, dashboards) unaffected — they only depend on `req.user`, whose shape is unchanged
- [ ] BullBoard `/queues` JWT auth still works (uses `BullBoardMiddleware`)
- [ ] Cold-start JWKS fetch adds no meaningful latency after first request (jose caches)
- [ ] Backend unit tests: update `auth.service.spec.ts` / `auth.controller.spec.ts` for removed methods at Phase 6

---

## G. Definition of done

1. A pre-existing prod user logs in via Better Auth with their **original** password — no reset.
2. New users sign up, verify, and are gated by the same `INACTIVE→FLAGGED→ACTIVE` lifecycle.
3. Every `@Roles()` route behaves exactly as before.
4. Legacy `/auth/*`, `JWT_SECRET`, `passport-jwt`, and `User.password` are removed (Phase 6) with zero auth incidents during soak.
5. Frontend carries a Better Auth JWT as `Authorization: Bearer` — same pattern, new issuer.
