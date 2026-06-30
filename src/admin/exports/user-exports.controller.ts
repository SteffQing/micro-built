import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AuthUser } from 'src/common/types';
import { ApiNullOkResponse } from 'src/common/decorators';
import { ExportService } from './exports.service';
import {
  ExportCashLoansDto,
  ExportRepaymentsDto,
} from '../common/dto/export.dto';

const QUEUED_MESSAGE =
  'Your export is being generated and will be emailed to you shortly';

@ApiTags('User Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  exportRepayments(@Req() req: Request, @Query() dto: ExportRepaymentsDto) {
    const { userId, email } = req.user as AuthUser;
    return this.service.queueExport('repayments', dto, email, userId);
  }

  @Get('loans')
  @ApiOperation({
    summary: 'Export my loans to Excel',
    description:
      'Queues an Excel export of the signed-in user’s own cash loans and emails it to them.',
  })
  @ApiNullOkResponse('Export queued', QUEUED_MESSAGE)
  exportLoans(@Req() req: Request, @Query() dto: ExportCashLoansDto) {
    const { userId, email } = req.user as AuthUser;
    return this.service.queueExport('cash_loans', dto, email, userId);
  }
}
