import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

const COMMODITY = { id: true, name: true, active: true, createdAt: true } satisfies Prisma.CommoditySelect;
export type CommodityRow = Prisma.CommodityGetPayload<{ select: typeof COMMODITY }>;
export type CommodityListRow = CommodityRow & { inUse: boolean };

/** "  solar   PANEL " → "Solar Panel": one spelling per commodity, so duplicates are exact matches. */
export function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// A commodity an asset request points at is never deleted (the loan keeps its name); deactivating
// it hides it from customers' request forms. One nothing uses can be deleted by a super admin.
@Injectable()
export class CommoditiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CommodityListRow[]> {
    const rows = await this.prisma.commodity.findMany({
      orderBy: { name: 'asc' },
      select: { ...COMMODITY, _count: { select: { loans: true } } },
    });
    return rows.map(({ _count, ...row }) => ({ ...row, inUse: _count.loans > 0 }));
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

  /**
   * The commodity with this name in any case, created if it doesn't exist (the existing-customer
   * upload names assets freely). Unlike add, never a 409; an inactive one is returned as is.
   */
  async ensure(rawName: string): Promise<CommodityRow> {
    const name = titleCase(rawName);
    if (!name) throw new BadRequestException('Enter a commodity name');
    const find = () =>
      this.prisma.commodity.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: COMMODITY });

    const existing = await find();
    if (existing) return existing;
    try {
      return await this.prisma.commodity.create({ data: { name }, select: COMMODITY });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await find();
        if (raced) return raced;
      }
      throw error;
    }
  }

  /** Only while no asset request uses it; the Restrict foreign key backs this up against a race. */
  async remove(id: string): Promise<CommodityRow> {
    const commodity = await this.prisma.commodity.findUnique({
      where: { id },
      select: { ...COMMODITY, _count: { select: { loans: true } } },
    });
    if (!commodity) throw new NotFoundException('Commodity not found');
    const { _count, ...row } = commodity;
    const inUse = `${row.name} has asset requests, so it can't be deleted. Hide it from customers instead.`;
    if (_count.loans > 0) throw new ConflictException(inUse);
    try {
      await this.prisma.commodity.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(inUse);
      }
      throw error;
    }
    return row;
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
