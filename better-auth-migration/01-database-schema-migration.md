# 01 — Database Schema Migration

**Repo:** `micro-built` (backend) · **File:** `prisma/schema.prisma` · **DB:** PostgreSQL

This is the highest-risk step because it touches the live `User` table. Everything here is **additive and reversible**. We do **not** drop the legacy `password` column until cutover is proven (file 05).

---

## 0. Golden rules

1. **Never** run `prisma migrate dev` against production. Use `prisma migrate deploy` on reviewed SQL only.
2. Back up the DB before each migration: `pg_dump "$DATABASE_URL" > backup_$(date +%F_%H%M).sql`.
3. Apply in **three** separate migrations, in order:
   - **M1** — add Better Auth tables + new `User` columns (purely additive, safe).
   - **M2** — data backfill (passwords → `account`, `emailVerified`).
   - **M3** — *(deferred to cleanup, file 05)* drop legacy `User.password`.

---

## 1. The four new Better Auth tables

Better Auth's core needs `user`, `session`, `account`, `verification`. The `jwt` plugin adds `jwks`. You already have a `User` table, so we **extend** it and **add the other four**.

> Generate these with the CLI rather than hand-writing them, then review the diff:
> ```bash
> # from micro-built/, after auth.ts exists (file 02)
> npx @better-auth/cli@latest generate --config src/auth/better-auth/auth.ts
> ```
> The CLI appends Prisma models to `schema.prisma`. The models below are what to expect — verify names/types match before migrating.

### 1a. Extend `User`

```prisma
model User {
  id            String   @id
  // ... all existing fields stay ...
  password      String?  // CHANGED: was non-null → now nullable (BA stores creds in Account)
  emailVerified Boolean  @default(false) // NEW: required by Better Auth
  // image is OPTIONAL: BA's "image" maps to existing "avatar" via field mapping (file 02), no new column needed

  sessions Session[] // NEW relation
  accounts Account[] // NEW relation
  // ... existing relations stay ...
}
```

- `password` → **nullable**. This is mandatory: Better Auth creates user rows with no `password` (credentials live in `Account`). A `NOT NULL` column with no default would make every Better Auth signup fail.
- `emailVerified` → new `Boolean @default(false)`.
- `avatar` is reused as Better Auth's `image` through config field-mapping — **no schema change** for it.
- `name`, `email`, `createdAt`, `updatedAt` already exist and satisfy Better Auth's requirements.
- `role`, `status`, `contact`, `externalId`, `repaymentRate`, `accountOfficerId`, `flagReason` remain and are exposed to Better Auth as **additionalFields** (file 02). They keep their Prisma defaults, so Better-Auth-driven inserts succeed without setting them.

### 1b. New tables

```prisma
model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Account {
  id                    String    @id
  accountId             String           // = user.id for the credential provider
  providerId            String           // "credential" for email/password
  userId                String
  password              String?          // bcrypt hash for credential accounts
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
}

model Jwks {
  id         String   @id
  publicKey  String
  privateKey String
  createdAt  DateTime @default(now())
}
```

> ID type: Better Auth defaults to `String` IDs. We override `advanced.database.generateId` to keep `MB-`/`AD-` IDs for **users** (file 02); session/account/verification/jwks IDs use Better Auth's default generator — that is fine, nothing else references them by format.

### 1c. Generate migration SQL (do **not** apply with dev)

```bash
# create the SQL without touching the DB, review it, then deploy
npx prisma migrate dev --create-only --name better_auth_tables   # local only, generates SQL
# review prisma/migrations/<ts>_better_auth_tables/migration.sql
# In prod:
npx prisma migrate deploy
```

M1 SQL should be only `CREATE TABLE` (session/account/verification/jwks), `ALTER TABLE "User" ADD COLUMN "emailVerified"`, and `ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL`. **No `DROP`.** If you see a `DROP`, stop and inspect.

---

## 2. Data backfill (M2)

Two backfills, run **after** M1 is deployed and **before** flipping any user onto Better Auth.

### 2a. Move credentials into `Account`

Every existing user with a password needs a `credential` account row carrying the **same bcrypt hash**. Because we configure Better Auth to hash/verify with bcrypt (file 02), these validate untouched.

```sql
-- backfill credential accounts from legacy User.password
INSERT INTO "Account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
SELECT
  'cred-' || u.id      AS id,          -- deterministic, collision-free
  u.id                 AS "accountId",
  'credential'         AS "providerId",
  u.id                 AS "userId",
  u.password           AS password,
  now(), now()
FROM "User" u
WHERE u.password IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Account" a
    WHERE a."userId" = u.id AND a."providerId" = 'credential'
  );
```

Idempotent (the `NOT EXISTS` guard), so it is safe to re-run.

### 2b. Backfill `emailVerified`

Map the existing lifecycle onto Better Auth's `emailVerified` flag:

- `status = 'INACTIVE'` → not yet email-verified → `emailVerified = false`
- `status IN ('FLAGGED','ACTIVE')` → already past verification → `emailVerified = true`

```sql
UPDATE "User" SET "emailVerified" = (status <> 'INACTIVE');
```

> This makes Better Auth's `requireEmailVerification` gate behave exactly like today's "block `INACTIVE` at login" rule (file 02 §sign-in gate).

### 2c. Contact-only users (only if you chose the synthetic-email path — see 00 §7b)

Contact-only rows have `email = NULL`, which Better Auth's credential flow cannot key on. Give them a deterministic synthetic email and mark verified:

```sql
UPDATE "User"
SET email = contact || '@contact.microbuilt.local',
    "emailVerified" = true
WHERE email IS NULL AND contact IS NOT NULL;
```

> ⚠️ Confirm no real notification logic sends mail to `User.email` for these rows (it shouldn't — they were contact-only). Audit `NotificationModule` before running. If you adopt the `phoneNumber` plugin instead, skip this entirely.

### Run backfills as a Prisma script (recommended over psql for prod)

Put the SQL in `prisma/backfills/better-auth-accounts.js` (mirrors the existing `prisma/backfills/interest-paid.js` pattern) and run with `node`. This gives you logging and a transaction:

```js
// prisma/backfills/better-auth-accounts.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const r1 = await prisma.$executeRawUnsafe(`/* 2a INSERT ... */`);
  const r2 = await prisma.$executeRawUnsafe(`UPDATE "User" SET "emailVerified" = (status <> 'INACTIVE');`);
  console.log({ accountsInserted: r1, usersUpdated: r2 });
  await prisma.$disconnect();
})();
```

---

## 3. Verification queries (run after M2)

```sql
-- every credentialed user has exactly one credential account
SELECT count(*) AS users_with_pw FROM "User" WHERE password IS NOT NULL;
SELECT count(*) AS credential_accounts FROM "Account" WHERE "providerId" = 'credential';
-- the two counts must match

-- no verified user left without the flag
SELECT count(*) FROM "User" WHERE status <> 'INACTIVE' AND "emailVerified" = false; -- expect 0

-- spot check a known admin can be resolved
SELECT u.id, u.email, u."emailVerified", u.role, a."providerId"
FROM "User" u JOIN "Account" a ON a."userId" = u.id
WHERE u.role IN ('ADMIN','SUPER_ADMIN') LIMIT 5;
```

---

## 4. Rollback (per migration)

- **M2 backfill:** the `account` rows are additive; to undo, `DELETE FROM "Account" WHERE id LIKE 'cred-%';` and `UPDATE "User" SET "emailVerified" = false;`. The legacy `User.password` is still intact, so the old `/auth` controller keeps working throughout.
- **M1 schema:** keep a `down.sql` that drops the four tables and the `emailVerified` column and re-adds `NOT NULL` on `password` (only safe while no Better-Auth-created users exist — i.e. before cutover). After real Better Auth signups exist, do **not** re-add `NOT NULL`.
- **Always** keep the `pg_dump` from step 0 as the ultimate restore point.

---

## 5. Order of operations checklist

- [ ] `pg_dump` backup taken
- [ ] `auth.ts` exists (file 02) so `cli generate` can produce accurate models
- [ ] M1 reviewed (additive only, no DROP) and `migrate deploy`-ed
- [ ] M2 backfill script run; verification queries in §3 pass
- [ ] Legacy `User.password` **left in place** (drop is M3, in file 05 cleanup)
- [ ] Proceed to file 02 (Better Auth server)
