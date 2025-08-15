import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AcceptCommodityLoanDto,
  CashLoanQueryDto,
  CommodityLoanQueryDto,
  LoanTermsDto,
} from '../common/dto';
import { Prisma } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';
import { generateId } from 'src/common/utils';

@Injectable()
export class CashLoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  async getAllLoans(dto: CashLoanQueryDto) {
    const { status, page = 1, limit = 20 } = dto;
    const where: Prisma.LoanWhereInput = {};
    if (status) where.status = status;
    const [_loans, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          borrowerId: true,
          category: true,
          loanTenure: true,
          extension: true,
          status: true,
        },
      }),
      this.prisma.loan.count({ where }),
    ]);
    const loans = _loans.map(
      ({ createdAt, borrowerId, extension, ...loan }) => ({
        ...loan,
        date: new Date(createdAt),
        customerId: borrowerId,
        amount: loan.amount.toNumber(),
        loanTenure: loan.loanTenure + extension,
      }),
    );
    return {
      data: loans,
      meta: {
        total,
        page,
        limit,
      },
      message: 'Queried all loans info',
    };
  }

  async getLoan(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { asset: true },
    });
    if (!loan) return null;
    const { managementFeeRate, interestRate, ...rest } = loan;

    return {
      ...rest,
      managementFeeRate: Number(managementFeeRate) * 100,
      interestRate: Number(interestRate) * 100,
    };
  }

  private async loanChecks(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        status: true,
        interestRate: true,
        amount: true,
        managementFeeRate: true,
      },
    });
    if (!loan) {
      throw new NotFoundException(
        'Commodity Loan with the provided id could not be found!',
      );
    }
    return loan;
  }

  async setLoanTerms(loanId: string, dto: LoanTermsDto) {
    const { status, interestRate, amount } = await this.loanChecks(loanId);
    if (status !== 'PENDING') {
      throw new HttpException(
        'Loan status not pending mean the loan already has its terms set.',
        HttpStatus.EXPECTATION_FAILED,
      );
    }

    const amountRepayable = amount.add(amount.mul(interestRate));
    await this.prisma.loan.update({
      where: { id: loanId },
      data: { loanTenure: dto.tenure, amountRepayable, status: 'PREVIEW' },
    });
  }

  async approveLoan(loanId: string) {
    const { status } = await this.loanChecks(loanId);
    if (status !== 'PREVIEW') {
      throw new HttpException(
        'Loan status must be in preview mode.',
        HttpStatus.EXPECTATION_FAILED,
      );
    }

    await this.prisma.loan.update({
      where: { id: loanId },
      data: { status: 'APPROVED' },
    });
  }

  async disburseLoan(loanId: string) {
    const { status, amount, managementFeeRate } = await this.loanChecks(loanId);
    if (status !== 'APPROVED') {
      throw new HttpException(
        'Loan status has not been approved to proceed.',
        HttpStatus.EXPECTATION_FAILED,
      );
    }
    const feeAmount = amount.mul(managementFeeRate); // managementFeeRate is a percentage (e.g., 0.03)
    const disbursedAmount = amount.sub(feeAmount);

    await Promise.all([
      this.config.topupValue('MANAGEMENT_FEE_REVENUE', feeAmount.toNumber()),
      this.config.topupValue('TOTAL_DISBURSED', disbursedAmount.toNumber()),
      this.prisma.loan.update({
        where: { id: loanId },
        data: { status: 'DISBURSED', disbursementDate: new Date() },
        select: { id: true },
      }),
    ]);
  }

  async rejectLoan(loanId: string) {
    const { status } = await this.loanChecks(loanId);
    if (status === 'DISBURSED' || status === 'REPAID') {
      throw new HttpException(
        'Loan status is not viable to be rejected.',
        HttpStatus.EXPECTATION_FAILED,
      );
    }

    await this.prisma.loan.update({
      where: { id: loanId },
      data: { status: 'REJECTED' },
      select: { id: true },
    });
  }
}

@Injectable()
export class CommodityLoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanService: CashLoanService,
    private readonly config: ConfigService,
  ) {}
  async getAllLoans(dto: CommodityLoanQueryDto) {
    const { search, inReview, page = 1, limit = 20 } = dto;
    const where: Prisma.CommodityLoanWhereInput = {};
    if (inReview !== undefined) where.inReview = inReview;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [_loans, total] = await Promise.all([
      this.prisma.commodityLoan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          userId: true,
          inReview: true,
          loanId: true,
        },
      }),
      this.prisma.commodityLoan.count({ where }),
    ]);
    const loans = _loans.map(({ createdAt, userId, ...loan }) => ({
      ...loan,
      date: new Date(createdAt),
      customerId: userId,
    }));

    return {
      data: loans,
      meta: {
        total,
        page,
        limit,
      },
      message: 'Queried all assets loans info',
    };
  }

  async getLoan(loanId: string) {
    const commodityLoan = await this.prisma.commodityLoan.findUnique({
      where: { id: loanId },
    });
    return commodityLoan;
  }

  private async loanChecks(cLoanId: string) {
    const commodityLoan = await this.prisma.commodityLoan.findUnique({
      where: { id: cLoanId },
      select: { inReview: true, userId: true },
    });
    if (!commodityLoan) {
      throw new NotFoundException(
        'Commodity Loan with the provided id could not be found!',
      );
    }
    if (!commodityLoan.inReview) {
      throw new HttpException(
        'Commodity loan seems to be resolved and cannot be manipulated further',
        HttpStatus.EXPECTATION_FAILED,
      );
    }
    return commodityLoan;
  }

  async approveCommodityLoan(cLoanId: string, dto: AcceptCommodityLoanDto) {
    const [cLoan, iRate] = await Promise.all([
      await this.loanChecks(cLoanId),
      this.config.getValue('INTEREST_RATE'),
    ]);
    if (iRate === null) {
      throw new InternalServerErrorException(
        'Loan interest rates are not properly configured.',
      );
    }

    const { privateDetails, publicDetails, managementFeeRate } = dto;
    const mRate = managementFeeRate / 100;
    const loanId = generateId.loanId();
    await this.prisma.commodityLoan.update({
      where: { id: cLoanId },
      data: {
        privateDetails,
        publicDetails,
        inReview: false,
        loan: {
          create: {
            id: loanId,
            amount: dto.amount,
            category: 'ASSET_PURCHASE',
            managementFeeRate: mRate,
            interestRate: iRate,
            borrowerId: cLoan.userId,
          },
        },
      },
    });
    await this.loanService.setLoanTerms(loanId, dto);
    return {
      message:
        'Commodity Loan has been approved and a corresponding cash loan, initiated! Awaiting approval from customer',
      data: { loanId },
    };
  }

  async rejectCommodityLoan(cLoanId: string) {
    const cLoan = await this.loanChecks(cLoanId);
    const loanId = generateId.loanId();
    await this.prisma.commodityLoan.update({
      where: { id: cLoanId },
      data: {
        inReview: false,
        loan: {
          create: {
            id: loanId,
            amount: 0,
            category: 'ASSET_PURCHASE',
            managementFeeRate: 0,
            interestRate: 0,
            borrowerId: cLoan.userId,
            status: 'REJECTED',
          },
        },
      },
    });
    return {
      message:
        'Commodity Loan has been updated and a corresponding cash loan, initiated and rejected!',
      data: { loanId },
    };
  }
}
