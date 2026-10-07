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
