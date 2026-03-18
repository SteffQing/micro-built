import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';
import { RepaymentsConsumer } from 'src/queue/bull/queue.repayments';

const prisma = new PrismaService();
const config = new ConfigService(prisma);
const rep_con = new RepaymentsConsumer(prisma, config);

(async () => {
  await rep_con.handleLiquidationRequest({
    data: { liquidationRequestId: '', amount: 10, userId: '' },
  } as any);
})();
