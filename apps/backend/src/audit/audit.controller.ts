import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { Access } from 'src/auth/decorators';
import { ApiOkPaginatedResponse } from 'src/common/decorators';
import { AuditEntryDto, AuditQueryDto } from './audit.dto';
import { AuditService } from './audit.service';

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
}
