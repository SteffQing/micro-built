# 00 — Target Architecture

## 1. Where the pieces live

```
                       microbuiltprime.com (Next.js 16, Vercel)
                       ├── authClient (better-auth/react)  ──┐  cookies (cross-subdomain) OR bearer
                       └── api (axios)                       │  Authorization: Bearer <JWT>
                                                             │
                                                             ▼
            api.microbuiltprime.com  (NestJS / Express, port 3003)
            ├── /api/auth/*    → Better Auth handler  (toNodeHandler(auth))
            │                     ├── Prisma adapter ─────────────┐
            │                     ├── jwt plugin  → GET /api/auth/jwks, /api/auth/token
            │                     └── bearer plugin
            ├── /auth/*        → OLD custom auth controller (kept during cutover, then deleted)
            └── /user, /admin… → resource routes, guarded by JwtStrategy (JWKS) + RolesGuard
                                                                    │
                                              ┌─────────────────────┘
                                              ▼
                         PostgreSQL (single DB, Prisma)
                         user · session · account · verification · jwks · …business tables
```

Better Auth is **not** a separate service. It is mounted onto the existing Express instance that NestJS already runs on. It talks to the **same** Postgres database through a Prisma adapter.

---

## 2. The two-credential model (important)

Better Auth issues **two distinct things**. Do not confuse them.

| Credential | Issued by | Verified by | Used for | Lifetime |
| --- | --- | --- | --- | --- |
| **Session token** (opaque) | Better Auth core | Better Auth itself (DB/`secondaryStorage` lookup) | Calls to `/api/auth/*` (signout, change-password, get-session) | `session.expiresIn` (7 days) |
| **JWT** (signed, JWKS) | `jwt` plugin | **Anyone**, via the JWKS public keys — incl. our NestJS resource guards | Calls to `/user`, `/admin`, … resource routes | `jwt.expirationTime` |

Our design:

- The **Better Auth React client** manages the **session** automatically (cross-subdomain cookie). You use it for sign-in/up/out, password reset, email verification.
- The **axios client** carries the **JWT** as `Authorization: Bearer …` to the resource API — exactly like today's `accessToken`. NestJS verifies that JWT against the JWKS endpoint, statelessly, then re-fetches `role`/`status` from the DB (parity with today).

This keeps the frontend's existing "bearer token in storage → axios interceptor" mental model intact, while the heavy lifting (CSRF, session rotation, secure cookies) is handled by Better Auth.

### Why not verify the session in NestJS instead?
You could call `auth.api.getSession({ headers })` in the guard, but that is a stateful DB lookup on every request and couples resource routes to Better Auth internals. The user asked for **strictly JWT style**, so resource routes verify a JWT via JWKS. (We still do one DB read for live role/status — see §5.)

---

## 3. Sign-in token flow

```
1. POST /api/auth/sign-in/email     (authClient.signIn.email)
       └─ Better Auth verifies bcrypt password, creates session,
          sets session cookie (.microbuiltprime.com) and returns set-auth-token header.

2. GET  /api/auth/token             (authClient.token() — uses the session)
       └─ jwt plugin mints a signed JWT { sub, role, email, contact }.
          Frontend stores it (replaces today's userAuthority.accessToken).

3. GET  /user  with  Authorization: Bearer <JWT>
       └─ JwtStrategy fetches JWKS (cached), verifies signature + exp,
          re-fetches role/status from DB, attaches req.user. RolesGuard runs.

4. On 401 (JWT expired) the axios interceptor calls authClient.token() again
   (session still valid) to mint a fresh JWT, then retries — OR redirects to /login
   if the session itself is gone.
```

> **v1 simplification:** set `jwt.expirationTime` to `7d` to mirror today's 7-day token and skip step-4 refresh entirely. Shorten to 15m–1h + refresh later once stable. Both paths are documented in `04-frontend-integration.md`.

---

## 4. JWT claims (parity with today)

Today's payload: `{ sub, email, contact, role, iat, exp }`. We reproduce it with the jwt plugin's `definePayload`:

```ts
jwt({
  jwt: {
    expirationTime: "7d",
    definePayload: ({ user }) => ({
      sub: user.id,
      email: user.email ?? undefined,
      contact: (user as any).contact ?? undefined,
      role: (user as any).role,
    }),
  },
})
```

`sub` defaults to `user.id` already; we set it explicitly for clarity. `role`/`contact` are additionalFields on the user model (see file 02).

---

## 5. Role & status freshness

Today `JwtStrategy.validate()` calls `AuthService.isValidUser()` which re-reads `role` + `status` from the DB on **every** request, so a demotion or a ban takes effect immediately even on an unexpired token. **We preserve this.** After JWKS signature verification, the new strategy still does one `prisma.user.findUnique({ select: { role, status } })`, throws on `INACTIVE`, and uses the DB role (not the claim) for `RolesGuard`. See `03-backend-resource-server.md`.

---

## 6. Cookies, CORS, cross-subdomain

Frontend is `microbuiltprime.com`; API is `api.microbuiltprime.com` — same parent domain, so a cookie scoped to `.microbuiltprime.com` works for the Better Auth client.

Required Better Auth config:

```ts
advanced: {
  useSecureCookies: true,
  crossSubDomainCookies: { enabled: true, domain: ".microbuiltprime.com" },
},
trustedOrigins: [
  "https://microbuiltprime.com",
  "https://www.microbuiltprime.com",
  "http://localhost:3000",
],
```

NestJS `enableCors` must keep `credentials: true` and echo the specific frontend origins (it already lists them in `src/main.ts`). Add the local dev origin if missing. **Never** use `origin: "*"` with credentials.

> If cross-subdomain cookies are undesirable, the **pure-bearer** fallback (store the session token from `set-auth-token`, send it as bearer to `/api/auth/*` too) is described in `04-frontend-integration.md §Fallback`.

---

## 7. Two product decisions to confirm before coding

### 7a. Email verification UX — code vs link
- **Today:** `POST /auth/verify-code` checks a 6-digit code stored in Redis at `verify:<email>`.
- **Better Auth default:** a verification **link** (`sendVerificationEmail`), no Redis, no plugin.
- **Recommended (core parity, no plugin):** switch to the link. The `/verify-code` page becomes a `/verify-email?token=…` landing page that calls `authClient.verifyEmail`.
- **To keep the exact 6-digit UX:** add the `emailOTP` plugin (technically a new plugin; flagged because scope is "core parity only").

### 7b. Contact-only users (no email)
- Better Auth credential accounts are keyed on a **unique email**.
- **No-plugin path:** derive a deterministic synthetic email `"<contact>@contact.microbuilt.local"`, set `emailVerified = true` for those rows, and have the "mobile" login tab sign in with that synthetic email. Pure client-side derivation, no server change.
- **Clean alternative:** the `phoneNumber` plugin (out of scope).

Both decisions are isolated and do not block the database work in file 01 — but resolve them before file 02/04.

---

## 8. Risk summary

| Risk | Mitigation |
| --- | --- |
| `User.password` is `NOT NULL`; Better Auth inserts users without it | Make column nullable **first** (file 01), backfill `account` rows |
| Body-parser ordering breaks the Better Auth handler in Express/NestJS | Mount `toNodeHandler` **before** global JSON parser (file 02 §Mounting) |
| Existing tokens become invalid at cutover | Parallel-run old `/auth` + new `/api/auth`; migrate the frontend behind a flag (file 05) |
| Role/ban changes not honoured on old tokens | DB re-fetch retained in the new strategy (§5) |
| Cross-subdomain cookie misconfig → silent 401s | `useSecureCookies` + `crossSubDomainCookies.domain` + CORS `credentials` (§6); pure-bearer fallback available |
