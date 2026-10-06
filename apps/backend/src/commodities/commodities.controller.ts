import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, getSchemaPath, ApiExtraModels } from '@nestjs/swagger';
import { AuditService } from 'src/audit/audit.service';
import { Access, CurrentUser, Roles } from 'src/auth/decorators';
import type { AuthUser } from 'src/common/types';
import { ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { CommoditiesService } from './commodities.service';
import { CommodityDto, CreateCommodityDto, UpdateCommodityDto } from './dto/commodity.dto';

@ApiTags('Commodities')
@Access('ADMIN', 'SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/commodities')
export class CommoditiesController {
  constructor(
    private readonly commodities: CommoditiesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Every commodity, active or not' })
  @ApiExtraModels(CommodityDto)
  @ApiOkResponse({
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(CommodityDto) } },
        message: { type: 'string', example: 'Commodities returned' },
      },
    },
  })
  async list() {
    return { data: await this.commodities.list(), message: 'Commodities returned' };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a commodity (saved in Title Case)' })
  @ApiOkBaseResponse(CommodityDto)
  @ApiGenericErrorResponse({
    desc: 'A commodity with this name (any case) exists',
    code: 409,
    err: 'Conflict',
    msg: 'Solar Panel already exists',
  })
  async add(@Body() dto: CreateCommodityDto, @CurrentUser() user: AuthUser) {
    const commodity = await this.commodities.add(dto.name);
    await this.audit.record({
      actorId: user.userId,
      action: 'COMMODITY_ADDED',
      entityType: 'COMMODITY',
      entityId: commodity.id,
      note: commodity.name,
    });
    return { data: commodity, message: `${commodity.name} added` };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Show or hide a commodity for customers' })
  @ApiOkBaseResponse(CommodityDto)
  @ApiGenericErrorResponse({ desc: 'No such commodity', code: 404, err: 'Not Found', msg: 'Commodity not found' })
  async setActive(@Param('id') id: string, @Body() dto: UpdateCommodityDto, @CurrentUser() user: AuthUser) {
    const commodity = await this.commodities.setActive(id, dto.active);
    const state = commodity.active ? 'available to customers' : 'hidden from customers';
    await this.audit.record({
      actorId: user.userId,
      action: 'COMMODITY_UPDATED',
      entityType: 'COMMODITY',
      entityId: commodity.id,
      note: `${commodity.name} ${state}`,
    });
    return { data: commodity, message: `${commodity.name} is now ${state}` };
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Delete a commodity (SUPER_ADMIN)',
    description: 'Only one no asset request uses (`inUse` false in the list); otherwise 409: hide it instead.',
  })
  @ApiOkBaseResponse(CommodityDto)
  @ApiGenericErrorResponse({ desc: 'No such commodity', code: 404, err: 'Not Found', msg: 'Commodity not found' })
  @ApiGenericErrorResponse({
    desc: 'Asset requests use it',
    code: 409,
    err: 'Conflict',
    msg: "Laptop has asset requests, so it can't be deleted. Hide it from customers instead.",
  })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const commodity = await this.commodities.remove(id);
    await this.audit.record({
      actorId: user.userId,
      action: 'COMMODITY_DELETED',
      entityType: 'COMMODITY',
      entityId: commodity.id,
      note: commodity.name,
    });
    return { data: commodity, message: `${commodity.name} deleted` };
  }
}
