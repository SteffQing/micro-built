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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import {
  RepaymentOverviewDto,
  RepaymentsResponseDto,
  SingleRepaymentWithUserDto,
} from '../common/entities';
import { FilterRepaymentsDto } from '../common/dto';
import {
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { ApiRoleForbiddenResponse } from '../common/decorators';

@ApiTags('Admin Repayments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/repayments')
export class RepaymentsController {
  constructor(private readonly service: RepaymentsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get repayment overview',
    description:
      'Returns a summary of repayment statistics including totals and failure counts.',
  })
  @ApiOkBaseResponse(RepaymentOverviewDto)
  @ApiRoleForbiddenResponse()
  getOverview() {
    return this.service.overview();
  }

  @Get()
  @ApiOperation({
    summary: 'Get all repayments',
    description:
      'Returns a paginated list of all repayments filtered by query parameters.',
  })
  @ApiOkPaginatedResponse(RepaymentsResponseDto)
  @ApiRoleForbiddenResponse()
  getRepayments(@Query() dto: FilterRepaymentsDto) {
    return this.service.getAllRepayments(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single repayment',
    description:
      'Fetches a single repayment by ID, along with user information.',
  })
  @ApiOkBaseResponse(SingleRepaymentWithUserDto)
  @ApiRoleForbiddenResponse()
  getRepayment(@Param('id') id: string) {
    return this.service.getRepaymentById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Manually resolve a repayment',
    description:
      'Manually marks a repayment as resolved — typically used when an automated deduction fails.',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan repayment manually set successfully',
    schema: {
      example: {
        message: 'Repayment status has been manually resolved!',
        data: null,
      },
    },
  })
  @ApiRoleForbiddenResponse()
  resolveRepayment(@Param('id') id: string) {
    return this.service.manuallyResolveRepayment(id);
  }
}
