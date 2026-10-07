import { applyDecorators, Body, Controller, Get, HttpCode, Param, Post, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { Access, Confirm, CurrentUser, Roles } from 'src/auth/decorators';
import {
  OrganizationSwitchRequestDto,
  OrganizationSwitchResultsDto,
} from 'src/change-requests/change-requests.dto';
import { ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { BaseResponseDto } from 'src/common/dto/generic.dto';
import type { AuthUser } from 'src/common/types';
import { MergedOrganizationsDto, MergeOrganizationsDto, OrganizationDto } from './organizations.dto';
import { OrganizationsService } from './organizations.service';

/** `{ data: Model[], message }`. */
function ApiOkArrayResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(BaseResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseDto) },
          { properties: { data: { type: 'array', items: { $ref: getSchemaPath(model) } } } },
        ],
      },
    }),
  );
}

const NOT_FOUND = { code: 404, err: 'Not Found', msg: 'Organization not found', desc: 'No organization with this id' };

@ApiTags('Admin:Organizations')
@Access('ADMIN', 'SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETER')
  @ApiOperation({
    summary: 'Organizations, A–Z, and where each one’s payroll stands',
    description:
      'Customers and running loans per organization, its latest locked month (a voucher or no payroll), its ' +
      'variations still waiting for a voucher, and whether it has deductions this month (none: the month is ' +
      'skipped for it). Marketers read it for the onboarding form.',
  })
  @ApiOkArrayResponse(OrganizationDto)
  async list() {
    const data = await this.service.list();
    return { data, message: 'Organizations fetched successfully' };
  }

  @Post(':id/merge')
  @HttpCode(200)
  @Confirm('action')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Merge this organization into another (a misspelling)',
    description:
      'Its payroll records and variations (with their vouchers) move to `intoId`, pending organization changes ' +
      'follow, and this organization is deleted. Refused when both have a variation for the same month, or when ' +
      'the move would leave a variation waiting for its voucher behind a locked one, or deductions that no ' +
      'generation of the merged organization could take (the message says which).',
  })
  @ApiOkBaseResponse(MergedOrganizationsDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  @ApiGenericErrorResponse({
    code: 409,
    err: 'Conflict',
    msg: 'Nigerian Navy and NAVY both have a variation for OCTOBER 2026, so they can’t be merged',
    desc: 'The merged organization wouldn’t stay consistent: a month both have a variation for, or variations out of order',
  })
  async merge(@Param('id') id: string, @Body() dto: MergeOrganizationsDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.merge(id, dto.intoId, user.userId);
    return { data, message: 'Organizations merged' };
  }

  @Post(':id/switch-requests')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Propose moving customers into this organization',
    description:
      'One change request per customer, found by external id (IPPIS / staff id); a super admin approves each through ' +
      '`POST /admin/change-requests/:id/approve`. Nothing moves until then. Deductions already in a variation stay ' +
      'with it; later months go with the new organization.',
  })
  @ApiOkBaseResponse(OrganizationSwitchResultsDto)
  @ApiGenericErrorResponse(NOT_FOUND)
  async switchRequests(
    @Param('id') id: string,
    @Body() dto: OrganizationSwitchRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    const results = await this.service.requestSwitches(id, dto.externalIds, user.userId);
    const created = results.filter((result) => result.outcome === 'CREATED').length;
    return {
      data: { results },
      message: created
        ? `${created} organization change${created === 1 ? '' : 's'} waiting for a super admin's approval`
        : 'No organization change was needed',
    };
  }
}
