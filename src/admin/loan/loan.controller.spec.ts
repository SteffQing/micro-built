import { Test, TestingModule } from '@nestjs/testing';
import { LoanController } from 'src/user/loan/loan.controller';
import { CashLoanService } from './loan.service';

describe('LoanController', () => {
  let controller: LoanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoanController],
      providers: [CashLoanService],
    }).compile();

    controller = module.get<LoanController>(LoanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
