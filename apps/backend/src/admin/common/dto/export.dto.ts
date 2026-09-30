import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';
import { CustomersQueryDto } from './customer.dto';
import { CashLoanQueryDto, CommodityLoanQueryDto } from './loan.dto';
import { FilterRepaymentsDto } from './repayment.dto';

/**
 * Export DTOs mirror the paginated list filters and add an optional recipient
 * email. They exist so the global `forbidNonWhitelisted` ValidationPipe accepts
 * `email` on the export query; the same filters drive both list and export.
 */

const emailDoc = {
  description:
    'Recipient email for the generated export. Defaults to the requester.',
  example: 'admin@microbuilt.com',
};

export class ExportCustomersDto extends CustomersQueryDto {
  @ApiPropertyOptional(emailDoc)
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ExportCashLoansDto extends CashLoanQueryDto {
  @ApiPropertyOptional(emailDoc)
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ExportCommodityLoansDto extends CommodityLoanQueryDto {
  @ApiPropertyOptional(emailDoc)
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ExportRepaymentsDto extends FilterRepaymentsDto {
  @ApiPropertyOptional(emailDoc)
  @IsOptional()
  @IsEmail()
  email?: string;
}
