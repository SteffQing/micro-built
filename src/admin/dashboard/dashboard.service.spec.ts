import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  const prisma = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([
        { month: 1, category: 'PERSONAL', total: '250000.00' },
      ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return disbursement chart data', async () => {
    const result = await service.getDisbursementChartData(2026);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.Jan).toEqual({
      categories: { PERSONAL: 250000 },
      total: 250000,
    });
  });
});
