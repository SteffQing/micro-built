import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { Access, Confirm, CurrentUser } from 'src/auth/decorators';
import { ApiGenericErrorResponse, ApiOkBaseResponse, ApiOkPaginatedResponse } from 'src/common/decorators';
import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUser } from 'src/common/types';
import {
  ChangeRequestDto,
  ChangeRequestsQueryDto,
  OwnChangeRequestsQueryDto,
  RejectChangeRequestDto,
} from './change-requests.dto';
import { ALREADY_DECIDED, ChangeRequestsService } from './change-requests.service';

/** Approving new bank details is how money could be pointed elsewhere, so it is confirmed each time. */
const bankDetails = async (request: Request, prisma: PrismaClient) =>
  (await prisma.changeRequest.findUnique({ where: { id: String(request.params.id) }, select: { kind: true } }))
    ?.kind === 'PAYMENT_METHOD';

const DECIDED = { code: 409, err: 'Conflict', msg: ALREADY_DECIDED, desc: 'Someone decided it first' };
const FORBIDDEN = {
  code: 403,
  err: 'Forbidden',
  msg: 'Only a super admin can decide a change to an admin’s details',
  desc: 'Your own request, or an admin’s request decided by someone who isn’t a super admin',
};

@ApiTags('User Change Requests')
@Access()
@Controller('user/change-requests')
export class UserChangeRequestsController {
  constructor(private readonly service: ChangeRequestsService) {}

  @Get()
  @ApiOperation({
    summary: 'The signed-in user’s change requests, latest first',
    description: 'Identity, payment method and profile changes waiting for (or decided by) an admin.',
  })
  @ApiOkPaginatedResponse(ChangeRequestDto)
  async list(@CurrentUser() user: AuthUser, @Query() query: OwnChangeRequestsQueryDto) {
    const { items, meta } = await this.service.listOwn(user.userId, query);
    return { data: items, meta, message: 'Change requests fetched successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Withdraw a pending change request' })
  @ApiOkBaseResponse(ChangeRequestDto)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: 'This request has already been decided',
    desc: 'Not pending any more',
  })
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const data = await this.service.cancel(id, user.userId);
    return { data, message: 'Change request withdrawn' };
  }
}

@ApiTags('Admin Change Requests')
@Access('ADMIN', 'SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/change-requests')
export class AdminChangeRequestsController {
  constructor(private readonly service: ChangeRequestsService) {}

  @Get()
  @ApiOperation({
    summary: 'Change requests, latest first',
    description:
      'Customers’ requests; a super admin also sees other admins’ profile changes. `canDecide` says whether ' +
      'the caller may approve or reject each one.',
  })
  @ApiOkPaginatedResponse(ChangeRequestDto)
  async list(@Query() query: ChangeRequestsQueryDto, @CurrentUser() user: AuthUser) {
    const { items, meta } = await this.service.list(query, user);
    return { data: items, meta, message: 'Change requests fetched successfully' };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Confirm('action', { when: bankDetails })
  @ApiOperation({ summary: 'Approve a pending change: the new details replace the live ones' })
  @ApiOkBaseResponse(ChangeRequestDto)
  @ApiGenericErrorResponse(DECIDED)
  @ApiGenericErrorResponse(FORBIDDEN)
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const data = await this.service.approve(id, user);
    return { data, message: 'Change approved' };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a pending change: the details stay as they are' })
  @ApiOkBaseResponse(ChangeRequestDto)
  @ApiGenericErrorResponse(DECIDED)
  @ApiGenericErrorResponse(FORBIDDEN)
  async reject(@Param('id') id: string, @Body() dto: RejectChangeRequestDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.reject(id, user, dto.note);
    return { data, message: 'Change rejected' };
  }
}
