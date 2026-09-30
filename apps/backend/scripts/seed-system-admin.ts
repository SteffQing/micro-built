import 'dotenv/config';
import { SYSTEM_EMAIL_DOMAIN } from '@microbuilt/shared';
import { PrismaClient, AdminRole, UserType, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Fixed, well-known id for the one singleton system actor — lets app code
// reference it as a constant instead of looking it up every time.
const SYSTEM_USER_ID = 'system';

async function main() {
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

main()
  .catch((err) => {
    // Non-fatal: a local build without DB access shouldn't fail the build.
    console.error('[seed] failed to seed system admin', err);
  })
  .finally(() => prisma.$disconnect());
