import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type KEY =
  | 'INTEREST_RATE'
  | 'MANAGEMENT_FEE_RATE'
  | 'PENALTY_FEE_RATE'
  | 'INTEREST_RATE_REVENUE'
  | 'MANAGEMENT_FEE_REVENUE'
  | 'TOTAL_DISBURSED'
  | 'TOTAL_REPAID'
  | 'COMMODITY_CATEGORIES'
  | 'IN_MAINTENANCE';

type ValueMap = {
  INTEREST_RATE: number;
  MANAGEMENT_FEE_RATE: number;
  PENALTY_FEE_RATE: number;
  INTEREST_RATE_REVENUE: number;
  MANAGEMENT_FEE_REVENUE: number;
  TOTAL_DISBURSED: number;
  TOTAL_REPAID: number;
  COMMODITY_CATEGORIES: string[];
  IN_MAINTENANCE: boolean;
};

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  private capitalize(str: string): string {
    return str
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  }

  async getValue<K extends KEY>(key: K) {
    const record = await this.prisma.config.findUnique({ where: { key } });
    if (!record) return null;

    switch (key) {
      case 'INTEREST_RATE':
      case 'MANAGEMENT_FEE_RATE':
      case 'INTEREST_RATE_REVENUE':
      case 'MANAGEMENT_FEE_REVENUE':
      case 'TOTAL_DISBURSED':
      case 'TOTAL_REPAID':
        return parseFloat(record.value) as ValueMap[K];
      case 'COMMODITY_CATEGORIES':
        return record.value
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean) as ValueMap[K];
      case 'IN_MAINTENANCE':
        return (record.value === 'true') as ValueMap[K];
      default:
        return null;
    }
  }

  private async setValue(key: KEY, value: string | number | boolean) {
    let stringified: string;

    switch (key) {
      case 'INTEREST_RATE':
      case 'MANAGEMENT_FEE_RATE':
        stringified = value.toString();
        break;
      case 'IN_MAINTENANCE':
        stringified = (value as boolean).toString();
        break;
      default:
        stringified = value as string;
    }

    await this.prisma.config.upsert({
      where: { key },
      create: { key, value: stringified },
      update: { value: stringified },
    });
  }

  async setRate(
    rate: Extract<KEY, 'INTEREST_RATE' | 'MANAGEMENT_FEE_RATE'>,
    value: number,
  ) {
    const percent = value / 100;
    await this.setValue(rate, percent);
  }

  async toggleMaintenanceMode() {
    const current = await this.getValue('IN_MAINTENANCE');
    const newValue = !(current === true);
    await this.setValue('IN_MAINTENANCE', newValue);
    return newValue;
  }

  async removeCommodityCategory(category: string) {
    const existing = await this.getValue('COMMODITY_CATEGORIES');
    if (!existing) return;

    const oldCat = this.capitalize(category.trim());
    const updatedList = existing.filter((c) => c !== oldCat);

    await this.setValue('COMMODITY_CATEGORIES', updatedList.join(','));
  }

  async addNewCommodityCategory(category: string) {
    const existing = await this.getValue('COMMODITY_CATEGORIES');
    const newCat = category.trim();

    if (!existing) {
      return await this.setValue('COMMODITY_CATEGORIES', newCat);
    }

    const currentList = existing.map((ex) => ex.toLowerCase());
    if (currentList.includes(newCat.toLowerCase())) return;

    existing.push(this.capitalize(newCat));
    await this.setValue('COMMODITY_CATEGORIES', existing.join(','));
  }

  async topupValue(
    key: Extract<
      KEY,
      | 'INTEREST_RATE_REVENUE'
      | 'MANAGEMENT_FEE_REVENUE'
      | 'TOTAL_DISBURSED'
      | 'TOTAL_REPAID'
    >,
    value: number,
  ) {
    const prevValue = await this.getValue(key);
    const newValue = (prevValue || 0) + value;
    await this.setValue(key, newValue.toString());
  }
}
