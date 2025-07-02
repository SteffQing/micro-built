import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { ResponseDto } from 'src/common/dto';
import {
  RepaymentOverviewDto,
  RepaymentsResponseDto,
  SingleRepaymentWithUserDto,
} from '../common/entities';
import { FilterRepaymentsDto } from '../common/dto';

@ApiTags('Admin Repayments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/repayments')
export class RepaymentsController {
  constructor(private readonly service: RepaymentsService) {}

  @Get('overview')
  @ApiOkResponse({ type: ResponseDto<RepaymentOverviewDto> })
  getOverview() {
    return this.service.overview();
  }

  @Get()
  @ApiOkResponse({ type: ResponseDto<[RepaymentsResponseDto]> })
  getRepayments(@Query() dto: FilterRepaymentsDto) {
    return this.service.getAllRepayments(dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: ResponseDto<SingleRepaymentWithUserDto> })
  getRepayment(@Param('id') id: string) {
    return this.service.getRepaymentById(id);
  }

  @Patch(':id')
  resolveRepayment(@Param('id') id: string) {
    return this.service.manuallyResolveRepayment(id);
  }
}
