import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from 'src/database/prisma.service';
import { CommoditiesService, titleCase } from './commodities.service';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Prisma ${code}`, { code, clientVersion: 'test' });

function setup() {
  const prisma = {
    commodity: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: { data: { name: string } }) => ({
        id: 'c1',
        name: data.name,
        active: true,
        createdAt: new Date(),
      })),
      update: jest.fn(),
    },
  };
  return { prisma, service: new CommoditiesService(prisma as unknown as PrismaService) };
}

describe('titleCase', () => {
  it('gives every commodity one spelling', () => {
    expect(titleCase('  solar   PANEL ')).toBe('Solar Panel');
    expect(titleCase('iPhone 15 pro')).toBe('Iphone 15 Pro');
    expect(titleCase('   ')).toBe('');
  });
});

describe('CommoditiesService', () => {
  it('saves new names in Title Case', async () => {
    const { prisma, service } = setup();
    const commodity = await service.add('solar panel');
    expect(commodity.name).toBe('Solar Panel');
    expect(prisma.commodity.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'Solar Panel', mode: 'insensitive' } },
      select: { id: true },
    });
  });

  it('refuses blank names and duplicates in any case, including a concurrent add', async () => {
    const { prisma, service } = setup();
    await expect(service.add('   ')).rejects.toThrow(BadRequestException);

    prisma.commodity.findFirst.mockResolvedValueOnce({ id: 'c1' });
    await expect(service.add('SOLAR PANEL')).rejects.toThrow(new ConflictException('Solar Panel already exists'));

    prisma.commodity.create.mockRejectedValueOnce(knownError('P2002'));
    await expect(service.add('solar panel')).rejects.toThrow(ConflictException);
  });

  it('hides a commodity instead of deleting it, and 404s an unknown id', async () => {
    const { prisma, service } = setup();
    prisma.commodity.update.mockResolvedValueOnce({ id: 'c1', name: 'Laptop', active: false, createdAt: new Date() });
    expect((await service.setActive('c1', false)).active).toBe(false);
    expect(prisma.commodity.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' }, data: { active: false } }),
    );

    prisma.commodity.update.mockRejectedValueOnce(knownError('P2025'));
    await expect(service.setActive('missing', true)).rejects.toThrow(NotFoundException);
  });

  it('lists only active names for customers', async () => {
    const { prisma, service } = setup();
    prisma.commodity.findMany.mockResolvedValueOnce([{ name: 'Laptop' }, { name: 'Solar Panel' }]);
    expect(await service.activeNames()).toEqual(['Laptop', 'Solar Panel']);
    expect(prisma.commodity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }));
  });
});
