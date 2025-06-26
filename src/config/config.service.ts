import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';

type KEYS = 'INTEREST_RATE' | 'MANAGEMENT_FEE';

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  private async getValue(key: string): Promise<Decimal | null> {
    const config = await this.prisma.config.findUnique({ where: { key } });
    return config?.value ?? null;
  }

  async getNumber(key: string): Promise<number> {
    const val = await this.getValue(key);
    return val ? Number(val) : NaN;
  }

  private async setValue(key: string, value: string): Promise<void> {
    await this.prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
