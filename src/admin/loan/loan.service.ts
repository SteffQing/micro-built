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
  ) { }
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
          principal: true,
          penalty: true,
          tenure: true,
          extension: true,
          interestRate: true,
          disbursementDate: true,
          createdAt: true,
          borrowerId: true,
          category: true,
          status: true,
        },
      }),
      this.prisma.loan.count({ where }),
    ]);
    const loans = _loans.map(
      ({ createdAt, borrowerId, principal, tenure, ...loan }) => ({
        ...loan,
        date: new Date(createdAt),
        customerId: borrowerId,
        amount: principal.toNumber(),
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
      select: {
        principal: true,
        penalty: true,
        tenure: true,
        extension: true,
        interestRate: true,
        disbursementDate: true,
        managementFeeRate: true,
        repaid: true,
        status: true,
        category: true,
        asset: { select: { name: true, id: true } },
        borrower: {
          select: {
            name: true,
            email: true,
            contact: true,
            externalId: true,
            id: true,
          },
        },
      },
    });
    if (!loan) return null;
    const { principal, ...rest } = loan;

    return {
      ...rest,
      id: loanId,
      managementFeeRate: rest.managementFeeRate.toNumber() * 100,
      interestRate: rest.interestRate.toNumber() * 100,
      amount: principal.toNumber(),
      amountRepaid: rest.repaid.toNumber(),
    };
  }

  private async loanChecks(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        status: true,
        interestRate: true,
        principal: true,
        managementFeeRate: true,
        borrowerId: true,
      },
    });
    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided id could not be found!',
      );
    }
    return loan;
  }

  async approveLoan(loanId: string, dto: LoanTermsDto) {
    const { status, borrowerId } =
      await this.loanChecks(loanId);
    if (status !== 'PENDING') {
      throw new HttpException(
        'Loan status not pending mean the loan already has its terms set.',
        HttpStatus.EXPECTATION_FAILED,
      );
    }

    // Amount Repayable should be per year
    await this.prisma.loan.update({
      where: { id: loanId },
      data: { tenure: dto.tenure, status: 'APPROVED' },
    });

    return {
      message: 'Loan approved successfully',
      data: { userId: borrowerId },
    };
  }

  async disburseLoan(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        borrowerId: true,
        status: true,
        managementFeeRate: true,
        principal: true,
        tenure: true,
      },
    });
    if (!loan) {
      throw new NotFoundException(
        'Loan with the provided id could not be found!',
      );
    }

    const { status, principal, managementFeeRate, borrowerId, ...rest } =
      loan;
    if (status !== 'APPROVED') {
      throw new HttpException(
        'Loan status has not been approved to proceed.',
        HttpStatus.EXPECTATION_FAILED,
      );
    }
    const feeAmount = principal.mul(managementFeeRate); // managementFeeRate is a percentage (e.g., 0.03)
    const disbursedAmount = principal.sub(feeAmount);
    const disbursementDate = new Date();

    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'DISBURSED',
        disbursementDate,
      },
    });

    await Promise.all([
      this.config.topupValue('MANAGEMENT_FEE_REVENUE', feeAmount.toNumber()),
      this.config.topupValue('TOTAL_DISBURSED', disbursedAmount.toNumber()),
    ]);

    return {
      message: 'Loan disbursed successfully',
      data: { userId: borrowerId },
    };
  }

  async rejectLoan(loanId: string) {
    const { status, borrowerId } = await this.loanChecks(loanId);
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

    return {
      message: 'Loan rejected successfully',
      data: { userId: borrowerId },
    };
  }
}

@Injectable()
export class CommodityLoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanService: CashLoanService,
    private readonly config: ConfigService,
  ) { }
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
          borrowerId: true,
          inReview: true,
          loanId: true,
        },
      }),
      this.prisma.commodityLoan.count({ where }),
    ]);
    const loans = _loans.map(({ createdAt, borrowerId, ...loan }) => ({
      ...loan,
      date: new Date(createdAt),
      customerId: borrowerId,
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
      select: {
        id: true,
        name: true,
        inReview: true,
        privateDetails: true,
        publicDetails: true,
        loanId: true,
        createdAt: true,
        borrower: {
          select: {
            name: true,
            email: true,
            contact: true,
            externalId: true,
            id: true,
          },
        },
      },
    });

    if (!commodityLoan) return null;
    const { borrower, ...loan } = commodityLoan;
    return { ...loan, borrower };
  }

  private async loanChecks(cLoanId: string) {
    const commodityLoan = await this.prisma.commodityLoan.findUnique({
      where: { id: cLoanId },
      select: { inReview: true, borrowerId: true },
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
            principal: dto.amount,
            category: 'ASSET_PURCHASE',
            managementFeeRate: mRate,
            interestRate: iRate,
            borrowerId: cLoan.borrowerId,
          },
        },
      },
    });
    await this.loanService.approveLoan(loanId, dto);
    return {
      message:
        'Commodity Loan has been approved and a corresponding cash loan, initiated! Awaiting approval from customer',
      data: { userId: cLoan.borrowerId },
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
            principal: 0,
            category: 'ASSET_PURCHASE',
            managementFeeRate: 0,
            interestRate: 0,
            borrowerId: cLoan.borrowerId,
            status: 'REJECTED',
          },
        },
      },
    });
    return {
      message:
        'Commodity Loan has been updated and a corresponding cash loan, initiated and rejected!',
      data: { userId: cLoan.borrowerId },
    };
  }
}
