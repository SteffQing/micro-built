import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { Access, CurrentUser } from 'src/auth/decorators';
import { ApiGenericErrorResponse, ApiOkBaseResponse, ApiOkPaginatedResponse } from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import { AuditEntryDto, AuditFileLinkDto, AuditQueryDto } from './audit.dto';
import { AuditService } from './audit.service';
import { requestOrigin } from './request-origin';

@ApiTags('Admin Audit')
@Access('SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'The audit log, newest first',
    description:
      'Every admin decision and change: loans, top-ups, tenure changes, payments, payroll, customers, change ' +
      'requests, settings, the commodity catalogue, imports and exports. Filter by who, what, which record and ' +
      'when (Lagos days).',
  })
  @ApiOkPaginatedResponse(AuditEntryDto)
  async list(@Query() query: AuditQueryDto) {
    const { items, meta } = await this.service.list(query);
    return { data: items, meta, message: 'Audit log fetched successfully' };
  }

  @Get(':id/file')
  @ApiOperation({
    summary: 'Download the file an entry kept',
    description:
      'A 5-minute link to the file an entry points at (`meta.storedFile`): today, a customer import’s sheet as ' +
      'uploaded. Fetching it is audited (DATA_EXPORTED on the same record).',
  })
  @ApiOkBaseResponse(AuditFileLinkDto)
  @ApiGenericErrorResponse({ desc: 'No such entry, or it kept no file', code: 404, err: 'Not Found', msg: 'This entry has no file' })
  async file(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() request: Request) {
    const data = await this.service.fileLink(id, user.userId, requestOrigin(request));
    return { data, message: 'Download link ready (valid 5 minutes)' };
  }
}
