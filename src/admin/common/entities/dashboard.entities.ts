import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { LoanCategory, LoanStatus } from '@prisma/client';

class DashboardOverviewDto {
  @ApiProperty({
    description: 'Total number of loans currently active (disbursed)',
    example: 18,
  })
  activeCount: number;

  @ApiProperty({
    description: 'Total number of loan requests currently pending approval',
    example: 7,
  })
  pendingCount: number;

  @ApiProperty({
    description: 'Total amount disbursed to customers (in NGN)',
    example: 560000,
  })
  totalDisbursed: number;

  @ApiProperty({
    description: 'Gross profit from interest and management fees (in NGN)',
    example: 39000,
  })
  grossProfit: number;
}

class DisbursementChartCategory {
  @ApiProperty({ example: 10000, default: 0 })
  EDUCATION?: number;

  @ApiProperty({ example: 25000, default: 0 })
  PERSONAL?: number;

  @ApiProperty({ example: 60000, default: 0 })
  BUSINESS?: number;

  @ApiProperty({ example: 15000, default: 0 })
  MEDICAL?: number;

  @ApiProperty({ example: 20000, default: 0 })
  RENT?: number;

  @ApiProperty({ example: 5000, default: 0 })
  TRAVEL?: number;

  @ApiProperty({ example: 12000, default: 0 })
  AGRICULTURE?: number;

  @ApiProperty({ example: 8000, default: 0 })
  UTILITIES?: number;

  @ApiProperty({ example: 7000, default: 0 })
  EMERGENCY?: number;

  @ApiProperty({ example: 3000, default: 0 })
  OTHERS?: number;

  @ApiProperty({ example: 40000, default: 0 })
  ASSET_PURCHASE?: number;
}

class DisbursementChartMonthDto {
  @ApiProperty({ type: DisbursementChartCategory })
  categories: DisbursementChartCategory;

  @ApiProperty({ example: 50000 })
  total: number;
}

class CashLoanRequestDto {
  @ApiProperty({
    description: 'ID of the requesting customer',
    example: 'USR-123',
  })
  customerId: string;

  @ApiProperty({ description: 'ID of the loan request', example: 'LN-A45DQ6' })
  id: string;

  @ApiProperty({ description: 'Requested loan amount', example: 50000 })
  amount: number;

  @ApiProperty({
    description: 'Category of the loan requested',
    enum: LoanCategory,
    example: LoanCategory.BUSINESS,
  })
  category: LoanCategory;

  @ApiProperty({
    description: 'Timestamp when the loan was requested',
    type: Date,
    example: new Date().toISOString(),
  })
  requestedAt: Date;
}

class CommodityLoanRequestDto {
  @ApiProperty({
    description: 'ID of the requesting customer',
    example: 'USR-456',
  })
  customerId: string;

  @ApiProperty({ description: 'ID of the commodity loan', example: 'CMD-789' })
  id: string;

  @ApiProperty({
    description: 'Name of the commodity requested',
    example: 'iPhone 15 Pro',
  })
  name: string;

  @ApiProperty({
    description: 'Category (always ASSET_PURCHASE for commodity loans)',
    enum: LoanCategory,
    example: LoanCategory.ASSET_PURCHASE,
  })
  category: LoanCategory;

  @ApiProperty({
    description: 'Timestamp when the commodity loan was requested',
    type: Date,
    example: new Date().toISOString(),
  })
  requestedAt: Date;
}

@ApiExtraModels(CashLoanRequestDto, CommodityLoanRequestDto)
class OpenLoanRequestsDto {
  @ApiProperty({ type: [CashLoanRequestDto] })
  cashLoans: CashLoanRequestDto[];

  @ApiProperty({ type: [CommodityLoanRequestDto] })
  commodityLoans: CommodityLoanRequestDto[];
}

@ApiExtraModels(CashLoanRequestDto, CommodityLoanRequestDto)
export class OpenLoanRequestsResponseDto {
  @ApiProperty({ example: 'Open loan requests fetched successfully' })
  message: string;

  @ApiProperty({
    type: 'object',
    properties: {
      cashLoans: {
        type: 'array',
        items: { $ref: getSchemaPath(CashLoanRequestDto) },
      },
      commodityLoans: {
        type: 'array',
        items: { $ref: getSchemaPath(CommodityLoanRequestDto) },
      },
    },
  })
  data: OpenLoanRequestsDto;
}

@ApiExtraModels(DisbursementChartMonthDto, DisbursementChartCategory)
export class DisbursementChartResponseDto {
  @ApiProperty({
    description: 'Message indicating the status of the request',
    example: 'Disbursement chart fetched successfully',
  })
  message: string;

  @ApiProperty({
    description:
      'object of disbursement data grouped by month and loan category',
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        categories: { $ref: getSchemaPath(DisbursementChartCategory) },
        total: { type: 'number' },
      },
      example: {
        categories: {
          EDUCATION: 10000,
          PERSONAL: 25000,
        },
        total: 35000,
      },
    },
    example: {
      Jan: {
        categories: {
          EDUCATION: 10000,
          BUSINESS: 20000,
        },
        total: 30000,
      },
      Feb: {
        categories: {},
        total: 0,
      },
    },
  })
  data: {
    [month: string]: DisbursementChartMonthDto;
  };
}

@ApiExtraModels(DashboardOverviewDto)
export class DashboardOverviewResponseDto {
  @ApiProperty({ example: 'Dashboard overview fetched successfully' })
  message: string;

  @ApiProperty({ type: DashboardOverviewDto })
  data: DashboardOverviewDto;
}

export class LoanReportOverviewDto {
  @ApiProperty({
    example: 1000000,
    description: 'Total amount disbursed to borrowers across all loans',
  })
  totalDisbursed: number;

  @ApiProperty({
    example: 750000,
    description: 'Total amount repaid by borrowers to date',
  })
  totalRepaid: number;

  @ApiProperty({
    example: 120000,
    description: 'Total interest revenue earned from loans',
  })
  interestEarned: number;

  @ApiProperty({
    example: 42,
    description: 'Count of loans currently active (disbursed and ongoing)',
  })
  activeLoansCount: number;

  @ApiProperty({
    example: 18,
    description: 'Count of loans currently pending approval or disbursement',
  })
  pendingLoansCount: number;
}

export class LoanReportStatusDistributionDto {
  @ApiProperty({
    description: 'Map of loan status to count',
    example: {
      PENDING: 40,
      DISBURSED: 80,
      DEFAULTED: 5,
    },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  statusCounts: Record<LoanStatus, number>;
}
