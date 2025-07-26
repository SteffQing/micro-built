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
        data: {
          type: 'array',
          items: { type: 'string' },
        },
        message: {
          type: 'string',
          example: 'Commodity categories returned',
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCommodities() {
    const categories = await this.config.getValue('COMMODITY_CATEGORIES');
    return { data: categories || [], message: 'Commodity categories returned' };
  }

  @Get('interest-rate')
  @ApiOperation({ summary: 'Get interest rate' })
  @ApiResponse({
    status: 200,
    description: 'Returns the interest rate',
    schema: {
      type: 'object',
      properties: {
        rate: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getInterestRate() {
    const rate = await this.config.getValue('INTEREST_RATE');
    return { data: (rate || 0) * 100, message: 'Interest rate returned' };
  }

  @Get('management-fee-rate')
  @ApiOperation({ summary: 'Get management fee rate' })
  @ApiResponse({
    status: 200,
    description: 'Returns the management fee rate',
    schema: {
      type: 'object',
      properties: {
        rate: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getManagementFeeRate() {
    const rate = await this.config.getValue('MANAGEMENT_FEE_RATE');
    return { data: (rate || 0) * 100, message: 'Management fee rate returned' };
  }

  @Get('maintenance-mode')
  @ApiOperation({ summary: 'Get maintenance mode' })
  @ApiResponse({
    status: 200,
    description: 'Returns the maintenance mode',
    schema: {
      type: 'object',
      properties: {
        mode: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getMaintenanceMode() {
    const mode = await this.config.getValue('IN_MAINTENANCE');
    return { data: mode || false, message: 'Maintenance mode returned' };
  }

  @Get()
  @ApiOperation({ summary: 'Get public config data' })
  @ApiResponse({
    status: 200,
    description: 'Returns the public config',
    schema: {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {
            maintenanceMode: { type: 'boolean' },
            interestRate: { type: 'number' },
            managementFeeRate: { type: 'number' },
            commodities: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPublicConfig() {
    const [maintenanceMode, interestRate, managementFeeRate, commodities] =
      await Promise.all([
        this.config.getValue('IN_MAINTENANCE'),
        this.config.getValue('INTEREST_RATE'),
        this.config.getValue('MANAGEMENT_FEE_RATE'),
        this.config.getValue('COMMODITY_CATEGORIES'),
      ]);

    const config = {
      maintenanceMode: maintenanceMode || false,
      interestRate: (interestRate || 0) * 100,
      managementFeeRate: (managementFeeRate || 0) * 100,
      commodities: commodities || [],
    };

    return { data: config || {}, message: 'Public config returned' };
  }
}
