import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from 'src/auth/decorators';
import { ApiOkBaseResponse } from 'src/common/decorators';
import { CommoditiesService } from 'src/commodities/commodities.service';
import { PublicConfigDto } from './dto/settings.dto';
import { toPercent } from './rates';
import { SettingsService } from './settings.service';

function ApiValueResponse(type: 'number' | 'boolean' | 'string[]', message: string, nullable = false) {
  const data = type === 'string[]' ? { type: 'array', items: { type: 'string' } } : { type, nullable };
  return ApiOkResponse({
    schema: { type: 'object', properties: { data, message: { type: 'string', example: message } } },
  });
}

// Public reads of the platform settings (routes and shapes kept from v1). Rates are percentages;
// an unset rate is null (v1 answered 0).
@ApiTags('Config')
@AllowAnonymous()
@Controller('config')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly commodities: CommoditiesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Rates, maintenance mode and active commodities' })
  @ApiOkBaseResponse(PublicConfigDto)
  async getPublicConfig() {
    const [settings, commodities] = await Promise.all([this.settings.get(), this.commodities.activeNames()]);
    const data: PublicConfigDto = {
      maintenanceMode: settings.inMaintenance,
      interestRate: toPercent(settings.interestRate),
      managementFeeRate: toPercent(settings.managementFeeRate),
      penaltyFeeRate: toPercent(settings.penaltyRate),
      maxDeductionRate: toPercent(settings.maxDeductionRate),
      commodities,
    };
    return { data, message: 'Public config returned' };
  }

  @Get('commodities')
  @ApiOperation({ summary: 'Active commodity names' })
  @ApiValueResponse('string[]', 'Commodity categories returned')
  async getCommodities() {
    return { data: await this.commodities.activeNames(), message: 'Commodity categories returned' };
  }

  @Get('interest-rate')
  @ApiOperation({ summary: 'Interest rate (percent; null until set)' })
  @ApiValueResponse('number', 'Interest rate returned', true)
  async getInterestRate() {
    const { interestRate } = await this.settings.get();
    return { data: toPercent(interestRate), message: 'Interest rate returned' };
  }

  @Get('management-fee-rate')
  @ApiOperation({ summary: 'Management fee rate (percent; null until set)' })
  @ApiValueResponse('number', 'Management fee rate returned', true)
  async getManagementFeeRate() {
    const { managementFeeRate } = await this.settings.get();
    return { data: toPercent(managementFeeRate), message: 'Management fee rate returned' };
  }

  @Get('maintenance-mode')
  @ApiOperation({ summary: 'Whether the platform is in maintenance mode' })
  @ApiValueResponse('boolean', 'Maintenance mode returned')
  async getMaintenanceMode() {
    const { inMaintenance } = await this.settings.get();
    return { data: inMaintenance, message: 'Maintenance mode returned' };
  }
}
