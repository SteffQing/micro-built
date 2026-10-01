import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Access, CurrentUser } from 'src/auth/decorators';
import { ApiDtoErrorResponse, ApiGenericErrorResponse, ApiNullOkResponse } from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import {
  ExportCashLoansDto,
  ExportCommodityLoansDto,
  ExportCustomersDto,
  ExportRepaymentsDto,
} from '../common/dto/export.dto';
import { ExportService } from './exports.service';

const QUEUED_MESSAGE =
  'Your export is being generated. The download link will be sent to admin@microbuilt.com and to your notifications';
const DELIVERY =
  'The whole filtered list (no pagination) as an Excel file, made in the background. When it is ready the requester ' +
  'gets an in-app notification with a download link (valid 7 days), also emailed to `email` or else to their own address.';

@ApiTags('Admin Exports')
@Access('ADMIN', 'SUPER_ADMIN')
@Controller('admin/exports')
export class AdminExportsController {
  constructor(private readonly service: ExportService) {}

  @Get('customers')
  @ApiOperation({
    summary: 'Export the customer list to Excel',
    description: `Same filters as GET /admin/customers. ${DELIVERY}`,
  })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  @ApiDtoErrorResponse('email must be an email')
  @ApiRoleForbiddenResponse()
  exportCustomers(@CurrentUser() user: AuthUser, @Query() dto: ExportCustomersDto) {
    return this.service.queueExport('customers', { ...dto }, user);
  }

  @Get('cash-loans')
  @ApiOperation({
    summary: 'Export the cash loans list to Excel',
    description: `Same filters as GET /admin/loans/cash. ${DELIVERY}`,
  })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  @ApiDtoErrorResponse('email must be an email')
  @ApiRoleForbiddenResponse()
  exportCashLoans(@CurrentUser() user: AuthUser, @Query() dto: ExportCashLoansDto) {
    return this.service.queueExport('cash_loans', { ...dto }, user);
  }

  @Get('commodity-loans')
  @ApiOperation({
    summary: 'Export the commodity loans list to Excel',
    description: `Same filters as GET /admin/loans/commodity. ${DELIVERY}`,
  })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  @ApiDtoErrorResponse('email must be an email')
  @ApiRoleForbiddenResponse()
  exportCommodityLoans(@CurrentUser() user: AuthUser, @Query() dto: ExportCommodityLoansDto) {
    return this.service.queueExport('commodity_loans', { ...dto }, user);
  }

  @Get('repayments')
  @ApiOperation({
    summary: 'Export the repayments list to Excel',
    description: `Same filters as GET /admin/repayments (money received: payroll rows and liquidations). ${DELIVERY}`,
  })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  @ApiDtoErrorResponse('from must be a month as YYYY-MM')
  @ApiGenericErrorResponse({
    desc: 'The range is backwards',
    err: 'Bad Request',
    msg: '`from` must not be after `to`',
    code: 400,
  })
  @ApiRoleForbiddenResponse()
  exportRepayments(@CurrentUser() user: AuthUser, @Query() dto: ExportRepaymentsDto) {
    return this.service.queueExport('repayments', { ...dto }, user);
  }
}
