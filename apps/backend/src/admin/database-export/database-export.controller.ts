import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requestOrigin } from 'src/audit/request-origin';
import { Access, Confirm, CurrentUser } from 'src/auth/decorators';
import { ApiDtoErrorResponse, ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { DatabaseExportQueuedDto, RequestDatabaseExportDto } from './database-export.dto';
import { DatabaseExportRequestService, EXPORT_IN_PROGRESS } from './database-export.service';

@ApiTags('Super Admin')
@Access('SUPER_ADMIN')
@Controller('admin/database-export')
export class DatabaseExportController {
  constructor(private readonly service: DatabaseExportRequestService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Confirm('action')
  @ApiOperation({
    summary: 'Export the whole database',
    description:
      'Every table, from one read-only snapshot, as an Excel workbook (a sheet per table) that opens only with ' +
      '`password`. Made in the background; the requester alone gets an in-app link, valid 1 hour, and the file is ' +
      'deleted after. Sign-in secrets (session tokens, password hashes, 2FA secrets) are withheld. One export at a ' +
      'time. Audited (DATABASE_EXPORT_REQUESTED with the reason, IP and browser; then DELIVERED or FAILED) and every ' +
      'other super admin is told.',
  })
  @ApiBody({ type: RequestDatabaseExportDto })
  @ApiOkBaseResponse(DatabaseExportQueuedDto)
  @ApiDtoErrorResponse(['Say why the database is being exported', 'Use a password of at least 12 characters'])
  @ApiGenericErrorResponse({ desc: 'One is already being made', code: 409, err: 'Conflict', msg: EXPORT_IN_PROGRESS })
  @ApiRoleForbiddenResponse()
  async request(@CurrentUser() user: AuthUser, @Body() dto: RequestDatabaseExportDto, @Req() request: Request) {
    const data = await this.service.request(user.userId, dto, requestOrigin(request));
    return {
      data,
      message: `The database export ${data.exportId} is being made. The download link will arrive in your notifications.`,
    };
  }
}
