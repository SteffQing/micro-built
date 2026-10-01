import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { Access, CurrentUser } from 'src/auth/decorators';
import { ApiGenericErrorResponse, ApiOkBaseResponse, ApiOkPaginatedResponse } from 'src/common/decorators';
import type { AuthUser } from 'src/common/types';
import {
  ProposeTenureChangeDto,
  RejectTenureChangeDto,
  TenureChangeItemDto,
  TenureChangeQueryDto,
} from './tenure-changes.dto';
import { TenureChangesAdminService } from './tenure-changes.service';

const DECIDED = { code: 409, err: 'Conflict', msg: 'Already decided by another admin', desc: 'Someone decided it first' };

@ApiTags('Admin Tenure Changes')
@Access('ADMIN', 'SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/tenure-changes')
export class TenureChangesController {
  constructor(private readonly service: TenureChangesAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Tenure changes, newest first',
    description:
      'Pending ones carry what approving would do: net pay, the deduction cap, the monthly deduction now and after.',
  })
  @ApiOkPaginatedResponse(TenureChangeItemDto)
  async list(@Query() query: TenureChangeQueryDto) {
    const { items, meta } = await this.service.list(query);
    return { data: items, meta, message: 'Tenure changes fetched successfully' };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: "Approve a pending change: the loan's tenure moves and the monthly deduction is re-spread" })
  @ApiOkBaseResponse(TenureChangeItemDto)
  @ApiGenericErrorResponse(DECIDED)
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const data = await this.service.approve(id, user.userId);
    return { data, message: 'Tenure change approved' };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a pending change' })
  @ApiOkBaseResponse(TenureChangeItemDto)
  @ApiGenericErrorResponse(DECIDED)
  async reject(@Param('id') id: string, @Body() dto: RejectTenureChangeDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.reject(id, user.userId, dto.note);
    return { data, message: 'Tenure change rejected' };
  }
}

@ApiTags('Admin Tenure Changes')
@Access('ADMIN', 'SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/customer')
export class CustomerTenureChangesController {
  constructor(private readonly service: TenureChangesAdminService) {}

  @Post(':id/tenure-changes')
  @ApiOperation({
    summary: "Propose a change to the customer's loan tenure (or apply it at once)",
    description:
      'One pending change per loan (409 otherwise). With apply: true the change is approved in the same call.',
  })
  @ApiOkBaseResponse(TenureChangeItemDto)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: 'This loan already has a pending tenure change',
    desc: 'A change is already waiting, or the loan is not active',
  })
  async propose(@Param('id') id: string, @Body() dto: ProposeTenureChangeDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.propose(id, dto, user.userId);
    return { data, message: dto.apply ? 'Tenure change applied' : 'Tenure change proposed' };
  }
}
