import { Controller, Get } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('commodities')
  @ApiOperation({ summary: 'Get commodity categories' })
  @ApiResponse({
    status: 200,
    description: 'Returns the list of commodity categories',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCommodities() {
    const categories = await this.config.getValue('COMMODITY_CATEGORIES');
    return { data: categories || [], message: 'Commodity categories returned' };
  }
}
