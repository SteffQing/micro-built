import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  AcceptCommodityLoanDto,
  CashLoanQueryDto,
  CommodityLoanQueryDto,
  LoanTermsDto,
} from '../common/dto';
import { Prisma } from '@prisma/client';
import { ConfigService } from 'src/config/config.service';
import { generateId } from 'src/common/utils';
import { CashLoanDto } from '../common/entities';

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
          amountBorrowed: true,
          createdAt: true,
          borrowerId: true,
          category: true,
          tenure: true,
          status: true,
        },
      }),
      this.prisma.loan.count({ where }),
    ]);
    const loans = _loans.map(
      ({ createdAt, borrowerId, amountBorrowed, tenure, ...loan }) => ({
        ...loan,
        date: new Date(createdAt),
        customerId: borrowerId,
        amount: amountBorrowed.toNumber(),
        loanTenure: tenure,
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

  async getLoan(loanId: string): Promise<CashLoanDto | null> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { asset: true },
    });
    if (!loan) return null;
    const { amountBorrowed, ...rest } = loan;

    return {
      ...rest,
      managementFeeRate: rest.managementFeeRate.toNumber() * 100,
      interestRate: rest.interestRate.toNumber() * 100,
      amountRepayable: rest.amountRepayable.toNumber(),
      amount: amountBorrowed.toNumber(),
      amountRepaid: rest.amountRepaid.toNumber(),
    };
  }

  private async loanChecks(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        status: true,
        interestRate: true,
        amountBorrowed: true,
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

  async approveLoan(loanId: string, dto: LoanTermsDto) {
    const { status, interestRate, amountBorrowed } =
      await this.loanChecks(loanId);
    if (status !== 'PENDING') {
      throw new HttpException(
        'Loan status not pending mean the loan already has its terms set.',
        HttpStatus.EXPECTATION_FAILED,
      );
    }

    const amountRepayable = amountBorrowed.add(
      amountBorrowed.mul(interestRate),
    );
    await this.prisma.loan.update({
      where: { id: loanId },
      data: { tenure: dto.tenure, amountRepayable, status: 'APPROVED' },
    });
  }

  async disburseLoan(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        borrowerId: true,
        status: true,
        managementFeeRate: true,
        amountRepayable: true,
        amountBorrowed: true,
        tenure: true,
      },
    });
    if (!loan) {
      throw new NotFoundException(
        'Commodity Loan with the provided id could not be found!',
      );
    }

    const DEFAULT_EXTENSION = 3;

    const { status, amountBorrowed, managementFeeRate, borrowerId, ...rest } =
      loan;
    if (status !== 'APPROVED') {
      throw new HttpException(
        'Loan status has not been approved to proceed.',
        HttpStatus.EXPECTATION_FAILED,
      );
    }
    const feeAmount = amountBorrowed.mul(managementFeeRate); // managementFeeRate is a percentage (e.g., 0.03)
    const disbursedAmount = amountBorrowed.sub(feeAmount);
    const disbursementDate = new Date();

    await this.prisma.$transaction(async (tx) => {
      const activeLoan = await tx.activeLoan.upsert({
        where: { userId: borrowerId },
        create: {
          disbursementDate,
          userId: borrowerId,
          id: generateId.anyId('ALN'),
          ...rest,
          isNew: true,
        },
        update: {
          tenure: { increment: Math.min(DEFAULT_EXTENSION, loan.tenure) },
          amountRepayable: { increment: loan.amountRepayable },
          isNew: false,
        },
        select: { id: true },
      });

      await tx.loan.update({
        where: { id: loanId },
        data: {
          status: 'DISBURSED',
          disbursementDate,
          activeLoanId: activeLoan.id,
        },
      });
    });
    await Promise.all([
      this.config.topupValue('MANAGEMENT_FEE_REVENUE', feeAmount.toNumber()),
      this.config.topupValue('TOTAL_DISBURSED', disbursedAmount.toNumber()),
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
            amountBorrowed: dto.amount,
            category: 'ASSET_PURCHASE',
            managementFeeRate: mRate,
            interestRate: iRate,
            borrowerId: cLoan.userId,
          },
        },
      },
    });
    await this.loanService.approveLoan(loanId, dto);
    return {
      message:
        'Commodity Loan has been approved and a corresponding cash loan, initiated! Awaiting approval from customer',
      data: null,
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
            amountBorrowed: 0,
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
      data: null,
    };
  }
}
