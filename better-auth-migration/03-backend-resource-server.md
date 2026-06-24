# 03 — Resource Server: verify the Better Auth JWT

**Repo:** `micro-built`. Goal: make `/user`, `/admin`, … trust JWTs minted by the `jwt` plugin, **without changing any `@Roles()`/`RolesGuard` usage** and **keeping the live role/status re-fetch**.

Today's chain (unchanged in shape):

```
@UseGuards(JwtAuthGuard)  →  JwtStrategy.validate()  →  req.user = { userId, role, ... }  →  RolesGuard
```

Only `JwtStrategy` changes: from an HS256 shared-secret check to **JWKS verification** of the Better-Auth JWT.

---

## 1. Install the verifier

```bash
cd micro-built
pnpm add jose          # JWKS fetch + verify; handles EdDSA/ES256 cleanly
pnpm add passport-custom
```

We swap `passport-jwt` for a tiny `passport-custom` strategy so we control JWKS verification with `jose`. (You may keep `passport-jwt` + `jwks-rsa`, but `jose` is simpler for Better Auth's default EdDSA keys.)

---

## 2. New `JwtStrategy` (JWKS + live role re-fetch)

Replace `src/auth/jwt.strategy.ts`:

```ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AuthService } from "./auth.service";

// JWKS from the embedded Better Auth instance. Same process, but fetched over HTTP
// so jose can cache + rotate. Use the internal URL in prod.
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL ?? "http://localhost:3003"}/api/auth/jwks`),
);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private auth: AuthService) {
    super();
  }

  async validate(req: Request) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException();
    const token = header.slice(7);

    let payload: any;
    try {
      const res = await jwtVerify(token, JWKS, {
        issuer: process.env.BETTER_AUTH_URL,            // BA sets iss to baseURL
        // audience: process.env.BETTER_AUTH_URL,       // enable if you set jwt.audience
      });
      payload = res.payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // PARITY: re-read role/status from DB on every request (throws if INACTIVE)
    const currentRole = await this.auth.isValidUser(payload.sub);

    return {
      userId: payload.sub,
      email: payload.email,
      contact: payload.contact,
      role: currentRole, // DB role wins over the claim — same as today
    };
  }
}
```

- `AuthService.isValidUser()` is **unchanged** — still re-fetches `role`+`status`, still throws `Unauthorized` on `INACTIVE`. This preserves immediate ban/demote behaviour.
- `req.user` shape is identical to today (`{ userId, email, contact, role }`), so **every** controller, `RolesGuard`, and `@AuthUser()` decorator keep working with no edits.

> `createRemoteJWKSet` caches keys in-process and refetches on key rotation, so this is one network hop on cold start, not per request. The per-request cost is the single `isValidUser` DB read you already pay today.

---

## 3. Guards / decorators — no changes

- `src/auth/jwt-auth.guard.ts` — `AuthGuard('jwt')` still resolves to the new strategy (we registered it under the name `"jwt"`). No edit.
- `src/auth/roles.guard.ts` — unchanged; reads `user.role`.
- `src/auth/roles.decorator.ts` (`@Roles`, `@BypassMaintenance`) — unchanged.
- All 8 guarded controllers — unchanged:
  - `src/user/user.controller.ts`
  - `src/user/loan/loan.controller.ts`
  - `src/user/repayments/repayments.controller.ts`
  - `src/admin/admin.controller.ts`
  - `src/admin/loan/loan.controller.ts`
  - `src/admin/repayments/repayments.controller.ts`
  - `src/admin/dashboard/dashboard.controller.ts`
  - `src/admin/customers/customers.controller.ts`

This is the payoff of the embedded + JWT design: the authorization surface is untouched.

---

## 4. `auth.module.ts` adjustments

```ts
// imports: JwtModule can stay during parallel-run (old /auth controller still signs HS256).
// providers: keep JwtStrategy (now JWKS-based), AuthService, MaintenanceGuard, BullBoardMiddleware.
```

At **cleanup** (file 05) you remove `JwtModule.register`, `passport-jwt`, `@nestjs/jwt`, and the old controller. Until then both coexist: old tokens verify via HS256? — **No.** Important nuance below.

### Parallel-run nuance
The new `JwtStrategy` verifies **only** Better-Auth JWKS tokens. The moment you deploy it, **old HS256 tokens stop validating** on resource routes. To avoid logging everyone out at deploy time, choose one:

- **(Recommended) Dual-verify during the window.** In `validate()`, try JWKS first; on failure, fall back to `jwt.verify(token, process.env.JWT_SECRET)` (old path). Accept either until the frontend cutover completes, then delete the fallback. Code:

```ts
try {
  const res = await jwtVerify(token, JWKS, { issuer: process.env.BETTER_AUTH_URL });
  payload = res.payload;
} catch {
  // LEGACY fallback — remove after cutover (file 05)
  const legacy = this.legacyJwt.verify(token); // @nestjs/jwt with JWT_SECRET
  payload = { sub: legacy.sub, email: legacy.email, contact: legacy.contact };
}
```

- **(Simpler, more disruptive)** Accept a one-time forced re-login: deploy the JWKS-only strategy at the same instant the frontend cutover ships. Everyone with a live old token gets a 401 → redirect to login. Acceptable for a small user base / off-peak deploy.

Pick dual-verify if you cannot tolerate a mass re-login.

---

## 5. Retire the old auth endpoints (at cutover, not now)

Keep `src/auth/auth.controller.ts` (`/auth/signup|login|verify-code|resend-code|forgot-password|reset-password`) **live** through the rollout so any in-flight client still works. After the frontend is fully on Better Auth and metrics are clean (file 05):

1. Delete `auth.controller.ts`, `auth.service.ts` login/signup/verify/reset methods (keep `isValidUser` — the strategy uses it).
2. Remove the dual-verify legacy fallback from `JwtStrategy`.
3. Remove `JwtModule.register`, `@nestjs/jwt`, `passport-jwt`, `JWT_SECRET`.
4. Drop the Redis `verify:*` / `reset:*` usage if nothing else references it.
5. Run M3 migration: `ALTER TABLE "User" DROP COLUMN password;` (legacy hash now lives only in `Account`).

Keep `AuthService.isValidUser`, `RolesGuard`, `MaintenanceGuard`, `BullBoardMiddleware` — all still in use.

---

## 6. Contact-login resolution (backend side)

If you took the synthetic-email path (00 §7b), the backend needs nothing extra — the frontend signs in with `"<contact>@contact.microbuilt.local"` and Better Auth treats it as a normal credential login. The `contact` column is still present and exposed in the JWT via `definePayload`. No new endpoint.

---

## 7. Checklist

- [ ] `jose` + `passport-custom` installed
- [ ] `JwtStrategy` rewritten (JWKS verify + `isValidUser` re-fetch)
- [ ] Dual-verify legacy fallback added (if avoiding mass re-login)
- [ ] `curl` a Better Auth JWT against `/user` → 200; against an INACTIVE user → 401
- [ ] All 8 controllers compile unchanged; `@Roles` still enforced
- [ ] Old `/auth/*` left running for parallel-run
