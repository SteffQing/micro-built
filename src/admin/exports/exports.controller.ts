import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { AuthUser } from 'src/common/types';
import { ApiNullOkResponse } from 'src/common/decorators';
import { ExportService } from './exports.service';
import {
  ExportCashLoansDto,
  ExportCommodityLoansDto,
  ExportCustomersDto,
  ExportRepaymentsDto,
} from '../common/dto/export.dto';

const QUEUED_MESSAGE =
  'Your export is being generated and will be emailed to you shortly';

@ApiTags('Admin Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'MARKETER')
@Controller('admin/exports')
export class AdminExportsController {
  constructor(private readonly service: ExportService) {}

  @Get('customers')
  @ApiOperation({
    summary: 'Export the customer list to Excel',
    description:
      'Queues an Excel export of customers matching the same filters as the list view; emailed to the requester (or the provided email).',
  })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  exportCustomers(@Req() req: Request, @Query() dto: ExportCustomersDto) {
    const { email } = req.user as AuthUser;
    return this.service.queueExport('customers', dto, email);
  }

  @Get('cash-loans')
  @ApiOperation({ summary: 'Export the cash loans list to Excel' })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  exportCashLoans(@Req() req: Request, @Query() dto: ExportCashLoansDto) {
    const { email } = req.user as AuthUser;
    return this.service.queueExport('cash_loans', dto, email);
  }

  @Get('commodity-loans')
  @ApiOperation({ summary: 'Export the commodity loans list to Excel' })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  exportCommodityLoans(
    @Req() req: Request,
    @Query() dto: ExportCommodityLoansDto,
  ) {
    const { email } = req.user as AuthUser;
    return this.service.queueExport('commodity_loans', dto, email);
  }

  @Get('repayments')
  @ApiOperation({ summary: 'Export the repayments list to Excel' })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  exportRepayments(@Req() req: Request, @Query() dto: ExportRepaymentsDto) {
    const { email } = req.user as AuthUser;
    return this.service.queueExport('repayments', dto, email);
  }
}
