import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from 'src/common/types';
import { ApiNullOkResponse } from 'src/common/decorators';
import { ExportService } from './exports.service';
import {
  ExportCashLoansDto,
  ExportRepaymentsDto,
} from '../common/dto/export.dto';
import { Access, CurrentUser } from 'src/auth/decorators';

const QUEUED_MESSAGE =
  'Your export is being generated and will be emailed to you shortly';

@ApiTags('User Exports')
@Access()
@Controller('user/exports')
export class UserExportsController {
  constructor(private readonly service: ExportService) {}

  @Get('repayments')
  @ApiOperation({
    summary: 'Export my repayments to Excel',
    description:
      'Queues an Excel export of the signed-in user’s own repayments and emails it to them.',
  })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  exportRepayments(
    @CurrentUser() user: AuthUser,
    @Query() dto: ExportRepaymentsDto,
  ) {
    return this.service.queueExport('repayments', { ...dto }, user, user.userId);
  }

  @Get('loans')
  @ApiOperation({
    summary: 'Export my loans to Excel',
    description:
      'Queues an Excel export of the signed-in user’s own cash loans and emails it to them.',
  })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  exportLoans(@CurrentUser() user: AuthUser, @Query() dto: ExportCashLoansDto) {
    return this.service.queueExport('cash_loans', { ...dto }, user, user.userId);
  }
}
