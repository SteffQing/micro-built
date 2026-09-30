import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath, ApiExtraModels } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ApiGenericErrorResponse, ApiOkBaseResponse } from 'src/common/decorators';
import { ApiRoleForbiddenResponse } from 'src/admin/common/decorators';
import { CommoditiesService } from './commodities.service';
import { CommodityDto, CreateCommodityDto, UpdateCommodityDto } from './dto/commodity.dto';

@ApiTags('Commodities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiRoleForbiddenResponse()
@Controller('admin/commodities')
export class CommoditiesController {
  constructor(private readonly commodities: CommoditiesService) {}

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
  async add(@Body() dto: CreateCommodityDto) {
    const commodity = await this.commodities.add(dto.name);
    return { data: commodity, message: `${commodity.name} added` };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Show or hide a commodity for customers' })
  @ApiOkBaseResponse(CommodityDto)
  @ApiGenericErrorResponse({ desc: 'No such commodity', code: 404, err: 'Not Found', msg: 'Commodity not found' })
  async setActive(@Param('id') id: string, @Body() dto: UpdateCommodityDto) {
    const commodity = await this.commodities.setActive(id, dto.active);
    const state = commodity.active ? 'available to customers' : 'hidden from customers';
    return { data: commodity, message: `${commodity.name} is now ${state}` };
  }
}
