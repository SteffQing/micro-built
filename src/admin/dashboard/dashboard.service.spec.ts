import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from 'src/database/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, PrismaService, ConfigService],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return disbursement chart data', async () => {
    const result = await service.getDisbursementChartData();
    console.dir(result, { depth: null });
    expect(result).toBeDefined(); // update this to a specific expectation if needed
  }, 100000);
});
