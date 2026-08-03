import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { AuthUser } from 'src/common/types';
import {
  CreateTenureChangeRequestDto,
  PenaltyAdjustmentDto,
  RejectTenureChangeDto,
  TenureChangePreviewDto,
} from './dto/tenure-change.dto';
import { RepaymentObligationService } from './repayment-obligation.service';

@ApiTags('Admin: Repayment Obligations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/repayment-obligations')
export class RepaymentObligationController {
  constructor(private readonly obligations: RepaymentObligationService) {}

  @Get('borrower/:borrowerId')
  @ApiOperation({ summary: 'Get the consolidated repayment obligation' })
  async getByBorrower(@Param('borrowerId') borrowerId: string) {
    return {
      data: await this.obligations.getByBorrower(borrowerId),
      message: 'Repayment obligation retrieved successfully',
    };
  }

  @Get(':id/tenure-history')
  @ApiOperation({ summary: 'Get immutable repayment-plan and tenure history' })
  async tenureHistory(@Param('id') obligationId: string) {
    return {
      data: await this.obligations.getTenureHistory(obligationId),
      message: 'Tenure history retrieved successfully',
    };
  }

  @Get(':id/audit-trail')
  @ApiOperation({ summary: 'Get the immutable obligation event trail' })
  async auditTrail(@Param('id') obligationId: string) {
    return {
      data: await this.obligations.getAuditTrail(obligationId),
      message: 'Obligation audit trail retrieved successfully',
    };
  }

  @Post(':id/penalty-adjustments')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Waive or reverse penalty with a full audit trail' })
  async adjustPenalty(
    @Req() req: Request,
    @Param('id') obligationId: string,
    @Body() dto: PenaltyAdjustmentDto,
  ) {
    const actor = req.user as AuthUser;
    return {
      data: await this.obligations.adjustPenalty(
        obligationId,
        dto,
        actor.userId,
      ),
      message: 'Penalty adjustment recorded and repayment plan revised',
    };
  }

  @Post(':id/tenure-change-preview')
  @ApiOperation({ summary: 'Preview a future-only tenure change' })
  async preview(
    @Param('id') obligationId: string,
    @Body() dto: TenureChangePreviewDto,
  ) {
    return {
      data: await this.obligations.previewTenureChange(obligationId, dto),
      message: 'Tenure change preview generated successfully',
    };
  }

  @Post(':id/tenure-change-requests')
  @ApiOperation({ summary: 'Request an auditable tenure change' })
  async requestChange(
    @Req() req: Request,
    @Param('id') obligationId: string,
    @Body() dto: CreateTenureChangeRequestDto,
  ) {
    const actor = req.user as AuthUser;
    return {
      data: await this.obligations.requestTenureChange(
        obligationId,
        dto,
        actor.userId,
      ),
      message: 'Tenure change request submitted successfully',
    };
  }

  @Post('tenure-change-requests/:requestId/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve and publish a tenure-change plan' })
  async approve(@Req() req: Request, @Param('requestId') requestId: string) {
    const actor = req.user as AuthUser;
    return {
      data: await this.obligations.approveTenureChange(requestId, actor.userId),
      message: 'Tenure change approved and new plan published',
    };
  }

  @Post('tenure-change-requests/:requestId/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject a tenure-change request' })
  async reject(
    @Req() req: Request,
    @Param('requestId') requestId: string,
    @Body() dto: RejectTenureChangeDto,
  ) {
    const actor = req.user as AuthUser;
    return {
      data: await this.obligations.rejectTenureChange(
        requestId,
        actor.userId,
        dto.reason,
      ),
      message: 'Tenure change rejected',
    };
  }
}
