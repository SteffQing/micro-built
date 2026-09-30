import 'dotenv/config';
import { PrismaClient, AdminRole, UserType, UserStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

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

  // No email/contact means it can never authenticate through the normal
  // login flow anyway, but password is still NOT NULL — fill it with a
  // hash nothing will ever match.
  const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

  const user = await prisma.user.create({
    data: {
      id: SYSTEM_USER_ID,
      type: UserType.ADMIN,
      name: 'System',
      password,
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
