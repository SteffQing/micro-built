import { Test, TestingModule } from '@nestjs/testing';
import { CashLoanService } from './loan.service';

describe('CashLoanService', () => {
  let service: CashLoanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashLoanService],
    }).compile();

    service = module.get<CashLoanService>(CashLoanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
