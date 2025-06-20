import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.customer.create({
    data: {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '08000000000',
      status: 'active',
      loans: {
        create: {
          amount: 150000,
          tenureDays: 90,
          status: 'approved',
          loanType: 'cash',
          disbursedDate: new Date(),
          repayments: {
            create: [
              {
                amount: 50000,
                date: new Date(),
                method: 'bank',
                status: 'success',
              },
            ],
          },
        },
      },
    },
  });
}

main().finally(() => prisma.$disconnect());
