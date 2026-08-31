import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { PrismaService } from 'src/database/prisma.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let prisma: {
    $executeRaw: jest.Mock;
    config: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        {
          provide: PrismaService,
          useValue: {
            $executeRaw: jest.fn().mockResolvedValue(1),
            config: {
              findUnique: jest.fn(),
              upsert: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getValue ─────────────────────────────────────────────────────────────

  describe('getValue', () => {
    it('returns null when key does not exist in DB', async () => {
      prisma.config.findUnique.mockResolvedValue(null);
      const result = await service.getValue('INTEREST_RATE');
      expect(result).toBeNull();
    });

    it('parses numeric keys as float', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'INTEREST_RATE',
        value: '0.15',
      });
      const result = await service.getValue('INTEREST_RATE');
      expect(result).toBe(0.15);
    });

    it('parses IN_MAINTENANCE "true" as boolean true', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'IN_MAINTENANCE',
        value: 'true',
      });
      const result = await service.getValue('IN_MAINTENANCE');
      expect(result).toBe(true);
    });

    it('parses IN_MAINTENANCE "false" as boolean false', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'IN_MAINTENANCE',
        value: 'false',
      });
      const result = await service.getValue('IN_MAINTENANCE');
      expect(result).toBe(false);
    });

    it('parses COMMODITY_CATEGORIES as trimmed, filtered string array', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'COMMODITY_CATEGORIES',
        value: 'Electronics, Furniture , Vehicles',
      });
      const result = await service.getValue('COMMODITY_CATEGORIES');
      expect(result).toEqual(['Electronics', 'Furniture', 'Vehicles']);
    });

    it('parses LAST_REPAYMENT_DATE as a Date instance', async () => {
      const iso = '2026-04-01T00:00:00.000Z';
      prisma.config.findUnique.mockResolvedValue({
        key: 'LAST_REPAYMENT_DATE',
        value: iso,
      });
      const result = await service.getValue('LAST_REPAYMENT_DATE');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).toISOString()).toBe(iso);
    });
  });

  // ─── inMaintenanceMode ────────────────────────────────────────────────────

  describe('inMaintenanceMode', () => {
    it('returns false when IN_MAINTENANCE is not set', async () => {
      prisma.config.findUnique.mockResolvedValue(null);
      const result = await service.inMaintenanceMode();
      expect(result).toBe(false);
    });

    it('returns true when IN_MAINTENANCE is "true"', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'IN_MAINTENANCE',
        value: 'true',
      });
      const result = await service.inMaintenanceMode();
      expect(result).toBe(true);
    });

    it('returns cached value on second call within TTL without hitting DB again', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'IN_MAINTENANCE',
        value: 'false',
      });
      const first = await service.inMaintenanceMode();
      const second = await service.inMaintenanceMode();
      expect(first).toBe(false);
      expect(second).toBe(false);
      expect(prisma.config.findUnique).toHaveBeenCalledTimes(1);
    });

    it('reflects the toggled value immediately after toggleMaintenanceMode', async () => {
      // Seed the cache as false
      prisma.config.findUnique.mockResolvedValue({
        key: 'IN_MAINTENANCE',
        value: 'false',
      });
      await service.inMaintenanceMode();

      // Toggle — now mock should return true
      prisma.config.findUnique.mockResolvedValue({
        key: 'IN_MAINTENANCE',
        value: 'true',
      });
      await service.toggleMaintenanceMode();

      // Next call to inMaintenanceMode should reflect the new value, not the stale cache
      const afterToggle = await service.inMaintenanceMode();
      expect(afterToggle).toBe(true);
    });
  });

  // ─── toggleMaintenanceMode ────────────────────────────────────────────────

  describe('toggleMaintenanceMode', () => {
    it('flips from false to true and returns true', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'IN_MAINTENANCE',
        value: 'false',
      });
      const result = await service.toggleMaintenanceMode();
      expect(result).toBe(true);
      expect(prisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { value: 'true' } }),
      );
    });

    it('flips from true to false and returns false', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'IN_MAINTENANCE',
        value: 'true',
      });
      const result = await service.toggleMaintenanceMode();
      expect(result).toBe(false);
      expect(prisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { value: 'false' } }),
      );
    });
  });

  // ─── topupValue ───────────────────────────────────────────────────────────

  describe('topupValue', () => {
    it('atomically increments an existing value', async () => {
      await service.topupValue('TOTAL_REPAID', 500);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual([
        'TOTAL_REPAID',
        '500',
        500,
      ]);
    });

    it('uses an atomic upsert so a missing key is created safely', async () => {
      await service.topupValue('TOTAL_REPAID', 250);
      expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual([
        'TOTAL_REPAID',
        '250',
        250,
      ]);
      expect(prisma.config.findUnique).not.toHaveBeenCalled();
    });
  });

  // ─── depleteValue ─────────────────────────────────────────────────────────

  describe('depleteValue', () => {
    it('atomically subtracts the amount', async () => {
      await service.depleteValue('BALANCE_OUTSTANDING', 200);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual([
        'BALANCE_OUTSTANDING',
        200,
      ]);
    });

    it('uses the SQL path that clamps negative results to zero', async () => {
      await service.depleteValue('BALANCE_OUTSTANDING', 500);
      const [strings, key, value] = prisma.$executeRaw.mock.calls[0];
      expect(key).toBe('BALANCE_OUTSTANDING');
      expect(value).toBe(500);
      expect(strings.join('')).toContain('GREATEST(0');
    });
  });
});
