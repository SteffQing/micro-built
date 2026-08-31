import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CustomersService } from '../customers/customers.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  const dashboardService = {
    getLoanStatusDistro: jest.fn().mockResolvedValue({
      DISBURSED: 2,
      PENDING: 1,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        { provide: CustomersService, useValue: {} },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return loan status data', async () => {
    const result = await controller.getLoanStatusDistribution();
    expect(result).toEqual({
      data: { statusCounts: { DISBURSED: 2, PENDING: 1 } },
      message: 'Loan status distribution fetched',
    });
  });
});
