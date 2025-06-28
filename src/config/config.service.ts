import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type KEY =
  | 'INTEREST_RATE'
  | 'MANAGEMENT_FEE_RATE'
  | 'COMMODITY_CATEGORIES'
  | 'IN_MAINTENANCE';

type ValueMap = {
  INTEREST_RATE: number;
  MANAGEMENT_FEE_RATE: number;
  COMMODITY_CATEGORIES: string[];
  IN_MAINTENANCE: boolean;
};

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  async getValue<K extends KEY>(key: K) {
    const record = await this.prisma.config.findUnique({ where: { key } });
    if (!record) return null;

    switch (key) {
      case 'INTEREST_RATE':
      case 'MANAGEMENT_FEE_RATE':
        return parseFloat(record.value) as ValueMap[K];
      case 'COMMODITY_CATEGORIES':
        return record.value
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean) as ValueMap[K];
      case 'IN_MAINTENANCE':
        return (record.value === 'true') as ValueMap[K];
      default:
        throw new Error(`Unhandled config key: ${key satisfies never}`);
    }
  }

  async setValue<K extends KEY>(key: K, value: ValueMap[K]) {
    let stringified: string;

    switch (key) {
      case 'INTEREST_RATE':
      case 'MANAGEMENT_FEE_RATE':
        stringified = value.toString();
        break;
      case 'COMMODITY_CATEGORIES':
        stringified = (value as string[]).join(',');
        break;
      case 'IN_MAINTENANCE':
        stringified = (value as boolean).toString();
        break;
      default:
        throw new Error(`Unhandled config key: ${key satisfies never}`);
    }

    await this.prisma.config.upsert({
      where: { key },
      create: { key, value: stringified },
      update: { value: stringified },
    });
  }
}
