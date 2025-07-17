import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CustomersService } from '../customers/customers.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule } from 'src/config/config.module';
import { CustomersModule } from '../customers/customers.module';

describe('DashboardController', () => {
  let controller: DashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [DashboardService, CustomersService],
      imports: [PrismaModule, ConfigModule, CustomersModule],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return loan status data', async () => {
    const result = await controller.getLoanStatusDistribution();
    console.dir(result, { depth: null });
    expect(result).toBeDefined(); // update this to a specific expectation if needed
  }, 100000);
});
