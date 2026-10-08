import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Connecting at boot: a database that is briefly unreachable (a proxy blip) is tried again before the API gives up. */
const CONNECT_ATTEMPTS = 5;
const CONNECT_BACKOFF_MS = 2_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientInitializationError) || attempt >= CONNECT_ATTEMPTS) throw error;
        const wait = CONNECT_BACKOFF_MS * attempt;
        this.logger.warn(`Database unreachable (attempt ${attempt} of ${CONNECT_ATTEMPTS}), trying again in ${wait / 1000} s`);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
