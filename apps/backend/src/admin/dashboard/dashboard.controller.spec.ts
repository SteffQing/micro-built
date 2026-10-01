import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from '../customers/customers.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// customers.service pulls in better-auth (ESM), which Jest can't load.
jest.mock('../customers/customers.service', () => ({ CustomersService: class {} }));

describe('DashboardController', () => {
  let controller: DashboardController;
  const dashboardService = {
    overview: jest.fn().mockResolvedValue({ activeCount: 1 }),
    loanReportOverview: jest.fn().mockResolvedValue({ activeLoansCount: 1 }),
    disbursementChart: jest.fn().mockResolvedValue([{ period: 'JUNE 2026', categories: {}, total: 0 }]),
    statusDistribution: jest.fn().mockResolvedValue({ statusCounts: { DISBURSED: 2, PENDING: 1 } }),
  };
  const customersService = { getOverview: jest.fn().mockResolvedValue({ activeCustomersCount: 4 }) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        { provide: CustomersService, useValue: customersService },
      ],
    }).compile();

    controller = module.get(DashboardController);
  });

  it('passes the period range to the overview', async () => {
    const query = { from: '2026-01', to: '2026-06' };
    await expect(controller.getOverview(query)).resolves.toEqual({
      data: { activeCount: 1 },
      message: 'Dashboard overview fetched successfully',
    });
    expect(dashboardService.overview).toHaveBeenCalledWith(query);
  });

  it('passes the period range to the loan report and the chart', async () => {
    await controller.getLoanReportOverview({ from: '2026-03' });
    expect(dashboardService.loanReportOverview).toHaveBeenCalledWith({ from: '2026-03' });

    const chart = await controller.getDisbursementChart({});
    expect(chart.data).toEqual([{ period: 'JUNE 2026', categories: {}, total: 0 }]);
    expect(dashboardService.disbursementChart).toHaveBeenCalledWith({});
  });

  it('returns the loan status distribution', async () => {
    await expect(controller.getLoanStatusDistribution()).resolves.toEqual({
      data: { statusCounts: { DISBURSED: 2, PENDING: 1 } },
      message: 'Loan status distribution fetched',
    });
  });

  it("serves the customers overview from CustomersService", async () => {
    await expect(controller.getCustomersOverview()).resolves.toEqual({
      data: { activeCustomersCount: 4 },
      message: 'Customers overview fetched successfully',
    });
  });
});
