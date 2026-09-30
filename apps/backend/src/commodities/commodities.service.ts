import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

const COMMODITY = { id: true, name: true, active: true, createdAt: true } satisfies Prisma.CommoditySelect;
export type CommodityRow = Prisma.CommodityGetPayload<{ select: typeof COMMODITY }>;

/** "  solar   PANEL " → "Solar Panel": one spelling per commodity, so duplicates are exact matches. */
export function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Commodities are never deleted: asset loans keep pointing at them. Deactivating one hides it
// from customers' request forms.
@Injectable()
export class CommoditiesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<CommodityRow[]> {
    return this.prisma.commodity.findMany({ orderBy: { name: 'asc' }, select: COMMODITY });
  }

  /** What customers may request. */
  async activeNames(): Promise<string[]> {
    const rows = await this.prisma.commodity.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return rows.map((row) => row.name);
  }

  async add(rawName: string): Promise<CommodityRow> {
    const name = titleCase(rawName);
    if (!name) throw new BadRequestException('Enter a commodity name');

    // Also catches rows saved before names were normalised.
    const existing = await this.prisma.commodity.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`${name} already exists`);

    try {
      return await this.prisma.commodity.create({ data: { name }, select: COMMODITY });
    } catch (error) {
      // Someone added the same name in between.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`${name} already exists`);
      }
      throw error;
    }
  }

  async setActive(id: string, active: boolean): Promise<CommodityRow> {
    try {
      return await this.prisma.commodity.update({ where: { id }, data: { active }, select: COMMODITY });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Commodity not found');
      }
      throw error;
    }
  }
}
