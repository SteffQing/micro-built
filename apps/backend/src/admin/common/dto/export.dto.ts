import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';
import { CustomersQueryDto } from './customer.dto';
import { CashLoanQueryDto, CommodityLoanQueryDto } from './loan.dto';
import { FilterRepaymentsDto } from './repayment.dto';

/**
 * Export DTOs are the list filters plus an optional `email` (the global `forbidNonWhitelisted`
 * ValidationPipe would refuse it otherwise). The export job filters with the list's own
 * `where` builder, so a list and its export always match; page/limit are ignored.
 */

const emailDoc = {
  description:
    "Also email the download link here. Defaults to the requester's own address; without either, the link " +
    'arrives as an in-app notification only.',
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
