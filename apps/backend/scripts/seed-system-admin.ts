import 'dotenv/config';
import { SYSTEM_EMAIL_DOMAIN } from '@microbuilt/shared';
import { PrismaClient, AdminRole, UserType, UserStatus } from '@prisma/client';
import { generateRandomString, hashPassword } from 'better-auth/crypto';
import { customAlphabet } from 'nanoid';

const prisma = new PrismaClient();

// Fixed, well-known id for the one singleton system actor — lets app code
// reference it as a constant instead of looking it up every time.
const SYSTEM_USER_ID = 'system';

async function seedSystemAdmin() {
  const existing = await prisma.admin.findFirst({
    where: { role: AdminRole.SYSTEM },
  });

  if (existing) {
    console.log(`[seed] system admin already exists (userId=${existing.userId})`);
    return;
  }

  // better-auth requires an email, so the system actor gets a placeholder on
  // the system domain (never mailed, never shown). It has no Account row, so
  // there is no credential it could ever sign in with.
  const user = await prisma.user.create({
    data: {
      id: SYSTEM_USER_ID,
      type: UserType.ADMIN,
      name: 'System',
      email: `system@${SYSTEM_EMAIL_DOMAIN}`,
      emailVerified: true,
      status: UserStatus.ACTIVE,
      admin: { create: { role: AdminRole.SYSTEM } },
    },
  });

  console.log(`[seed] created system admin (userId=${user.id})`);
}

// The first super admin, from SEED_SUPERADMIN_EMAIL / _PASSWORD (/ _NAME) so the credentials live in the
// environment, never in the repo. Skipped when unset or when that email already has a user. The admin signs in
// with the password and is then made to set up 2FA like any admin.
async function seedSuperAdmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) return;

  if (await prisma.user.findUnique({ where: { email } })) {
    console.log(`[seed] super admin ${email} already exists`);
    return;
  }

  const id = `AD-${customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 5)()}`;
  await prisma.user.create({
    data: {
      id,
      type: UserType.ADMIN,
      name: process.env.SEED_SUPERADMIN_NAME?.trim() || 'Super Admin',
      email,
      emailVerified: true,
      status: UserStatus.ACTIVE,
      admin: { create: { role: AdminRole.SUPER_ADMIN } },
      accounts: {
        create: {
          id: generateRandomString(32, 'a-z', 'A-Z', '0-9'),
          accountId: id,
          providerId: 'credential',
          password: await hashPassword(password),
        },
      },
    },
  });

  console.log(`[seed] created super admin ${email} (userId=${id})`);
}

async function main() {
  await seedSystemAdmin();
  await seedSuperAdmin();
}

main()
  .catch((err) => {
    // Non-fatal: a local build without DB access shouldn't fail the build.
    console.error('[seed] failed to seed', err);
  })
  .finally(() => prisma.$disconnect());
