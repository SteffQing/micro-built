# 02 — Better Auth Server (inside NestJS)

**Repo:** `micro-built` (backend). Goal: stand up Better Auth on the existing Express instance, sharing the Postgres DB, hashing with bcrypt, issuing JWTs.

---

## 1. Install

```bash
cd micro-built
pnpm add better-auth
# bcrypt + @prisma/client already present
```

## 2. Environment variables

Add to the backend env (and to the deploy platform's secrets):

```
BETTER_AUTH_SECRET=<openssl rand -base64 32>     # min 32 chars
BETTER_AUTH_URL=https://api.microbuiltprime.com  # base URL of the API host
# DATABASE_URL already set
```

Local dev: `BETTER_AUTH_URL=http://localhost:3003`.

> Keep the existing `JWT_SECRET` for now — the old `/auth` controller still uses it during parallel-run. Remove it at cleanup (file 05).

---

## 3. `auth.ts`

Create `src/auth/better-auth/auth.ts`. It instantiates its **own** `PrismaClient` (kept independent of Nest DI so the Better Auth handler can be constructed at module load):

```ts
// src/auth/better-auth/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { jwt } from "better-auth/plugins/jwt";
import { bearer } from "better-auth/plugins/bearer";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { generateId } from "../../common/utils"; // existing MB-/AD- generator

const prisma = new PrismaClient();

export const auth = betterAuth({
  // BETTER_AUTH_SECRET / BETTER_AUTH_URL are read from env automatically.
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // ── Credentials ───────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // mirrors today's "block INACTIVE" rule
    password: {
      // Use bcrypt so EVERY existing hash validates untouched.
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url, token }) => {
      // Reuse the existing Resend pipeline. `token` matches today's reset token shape.
      // Emit the same event the old flow used, or call NotificationService directly.
      // See §6.
    },
  },

  // ── Email verification (link-based; see 00 §7a) ───────────────
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      // Reuse Resend. `url` is the verify link the frontend lands on. See §6.
    },
  },

  // ── Map existing columns / keep custom fields ─────────────────
  user: {
    modelName: "user", // Prisma model name (NOT the table name)
    fields: {
      image: "avatar", // BA "image" reads/writes the existing avatar column
    },
    additionalFields: {
      role:             { type: "string", input: false }, // never settable by client
      status:           { type: "string", input: false },
      contact:          { type: "string", required: false, input: false },
      externalId:       { type: "string", required: false, input: false },
      repaymentRate:    { type: "number", required: false, input: false },
      accountOfficerId: { type: "string", required: false, input: false },
      flagReason:       { type: "string", required: false, input: false },
    },
  },
  session: { modelName: "session" },
  account: { modelName: "account" },
  verification: { modelName: "verification" },

  // ── Keep MB-/AD- user IDs ─────────────────────────────────────
  advanced: {
    database: {
      generateId: ({ model }) =>
        model === "user" ? generateId.userId() : undefined, // undefined → BA default for other models
    },
    useSecureCookies: true,
    crossSubDomainCookies: { enabled: true, domain: ".microbuiltprime.com" },
  },

  trustedOrigins: [
    "https://microbuiltprime.com",
    "https://www.microbuiltprime.com",
    "http://localhost:3000",
  ],

  // ── Replicate signup lifecycle (INACTIVE vs FLAGGED) ──────────
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const isContactOnly = !user.email || user.email.endsWith("@contact.microbuilt.local");
          return {
            data: {
              ...user,
              status: isContactOnly ? "FLAGGED" : "INACTIVE",
              emailVerified: isContactOnly ? true : user.emailVerified,
              flagReason: "New sign up via app! Requires documents to proceed",
            },
          };
        },
      },
    },
  },

  // ── Plugins: JWT for resource API + bearer for header auth ────
  plugins: [
    jwt({
      jwt: {
        expirationTime: "7d", // v1: match today. Shorten later (00 §3).
        definePayload: ({ user }) => ({
          sub: user.id,
          email: user.email ?? undefined,
          contact: (user as any).contact ?? undefined,
          role: (user as any).role,
        }),
      },
    }),
    bearer(),
  ],
});

export type Auth = typeof auth;
```

> Re-run `npx @better-auth/cli@latest generate --config src/auth/better-auth/auth.ts` after **any** plugin change to keep `schema.prisma` in sync (the `jwt` plugin's `Jwks` table comes from here).

---

## 4. Mount the handler inside NestJS (the body-parser gotcha)

Better Auth's `toNodeHandler` needs the **raw** request stream. NestJS registers a global JSON body parser that consumes it. Mount Better Auth **before** the JSON parser.

Edit `src/main.ts`:

```ts
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import { AppModule } from "./app.module";
import { auth } from "./auth/better-auth/auth";

async function bootstrap() {
  // disable Nest's automatic body parser so we control ordering
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(cookieParser());

  // 1) Better Auth FIRST, on the raw stream
  app.use("/api/auth/{*path}", toNodeHandler(auth));

  // 2) JSON parser for everything else (restores what bodyParser:false removed)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.useGlobalPipes(/* existing ValidationPipe unchanged */);
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "https://micro-built.vercel.app",
      "https://microbuiltprime.com",
      "https://www.microbuiltprime.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  // Swagger setup unchanged
  await app.listen(process.env.PORT ?? 3003);
}
bootstrap();
```

Notes:
- `"/api/auth/{*path}"` is the Express 5 splat syntax. On Express 4 use `"/api/auth/*"`. NestJS 11 ships Express 5 — verify with `pnpm why express`.
- Because `bodyParser: false` removes Nest's parser, re-adding `express.json()`/`urlencoded` **after** the auth mount keeps every existing controller working. Do not skip those two lines.
- The old `/auth` controller is **untouched** and still served by Nest — no path collision (`/auth` vs `/api/auth`).

---

## 5. Smoke test the server

```bash
pnpm start:dev
curl -s http://localhost:3003/api/auth/ok            # → {"status":"ok"}
curl -s http://localhost:3003/api/auth/jwks | jq .   # → { "keys": [ ... ] }  (jwt plugin live)
```

If `/api/auth/ok` 404s, the handler isn't mounted (check ordering / splat syntax). If it 500s, check `DATABASE_URL` and that M1 tables exist.

---

## 6. Wiring the emails to the existing Resend pipeline

Today, verification/reset emails are sent via `EventEmitter2` → `EventsModule` → `NotificationModule` (Resend). Two ways to reuse it from `auth.ts`:

**Option A — call the notification service directly.** Export a small singleton mailer that `auth.ts` imports, e.g. `sendResetPasswordEmail(email, url)`. Simplest, but bypasses the event bus.

**Option B — emit the existing events.** Construct an `EventEmitter2` accessible to `auth.ts` and emit `Auth.userForgotPassword` / `Auth.userSignUp`. Keeps the existing listener wiring, but the payloads differ (today they carry a Redis-stored code; Better Auth gives a `url`/`token`). You'll adjust the listener/template to render a link instead of a code.

Recommendation: **Option A** with a thin function that renders the existing React-email template but with a link. Keep the template visually identical; only the CTA target changes (code → link). This is the concrete consequence of decision 00 §7a.

> Password reset already used a **token** end-to-end today (`ResetPasswordBodyDto { token, newPassword }`), so reset maps 1:1 — only email **verification** changes from code to link.

---

## 7. Sign-in gate parity (INACTIVE / status)

`requireEmailVerification: true` blocks any user whose `emailVerified = false` — which the backfill set to exactly the `INACTIVE` cohort. So the "inactive accounts cannot log in" rule is enforced by Better Auth automatically. `FLAGGED` and `ACTIVE` users (emailVerified = true) log in normally, preserving today's behaviour where flagged users can still authenticate but are gated by admin onboarding elsewhere.

If you later need to block a *specific* status at sign-in (e.g. a future `SUSPENDED`), add a `hooks.before` matcher on `/sign-in/email` that loads the user and throws — but that's beyond current parity.

---

## 8. What this file produced

- `src/auth/better-auth/auth.ts` — the Better Auth instance (bcrypt, JWKS JWTs, custom IDs, lifecycle hook).
- `src/main.ts` — mounts `/api/auth/*` ahead of the JSON parser.
- Resend wiring for verification/reset emails.

Next: `03-backend-resource-server.md` — make the resource routes trust the new JWT.
