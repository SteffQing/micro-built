import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { AuthUser } from 'src/common/types';
import { PayrollVariationService } from 'src/obligations/payroll-variation.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import { PeriodDto } from '../common/dto';
import { PayrollVariationPreviewDto } from '../common/dto/payroll-variation.dto';

class SubmissionReferenceDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) reference: string;
}
class InitializePayrollDto extends SubmissionReferenceDto {
  @IsOptional() @IsString() scheduleId?: string;
  @IsOptional() @IsBoolean() noPriorInstructions?: boolean;
}
class EmailVariationDto {
  @IsEmail() email: string;
}

@ApiTags('Payroll variations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/payroll-variations')
export class PayrollVariationController {
  constructor(
    private readonly variations: PayrollVariationService,
    private readonly queue: QueueProducer,
  ) {}

  @Get()
  async state() {
    return {
      data: await this.variations.state(),
      message: 'Payroll variation history retrieved',
    };
  }

  @Post('initialize')
  @Roles('SUPER_ADMIN')
  async initialize(@Body() dto: InitializePayrollDto, @Req() req: Request) {
    return {
      data: await this.variations.initialize(
        dto,
        (req.user as AuthUser).userId,
      ),
      message: 'Payroll submission baseline recorded',
    };
  }

  @Post('preview')
  async preview(@Body() dto: PayrollVariationPreviewDto) {
    return {
      data: await this.variations.preview(dto.period, dto.changeFilter),
      message: 'Payroll changes calculated',
    };
  }

  @Post('backfill')
  @Roles('SUPER_ADMIN')
  async backfill(@Body() dto: PeriodDto) {
    return {
      data: await this.variations.backfill(dto.period),
      message:
        'Legacy repayment plans initialized. Refresh the variation preview.',
    };
  }

  @Post(':id/email')
  async email(@Param('id') id: string, @Body() dto: EmailVariationDto) {
    const batch = await this.variations.getBatch(id);
    if (!batch.rows.length || batch.kind === 'BASELINE')
      throw new BadRequestException(
        'This record has no variation file to email',
      );
    const period = this.variations.serialize(batch).period;
    try {
      await this.queue.generateReport({
        period,
        email: dto.email,
        variationBatchId: id,
      });
    } catch (error) {
      await this.variations.recordEmail(
        id,
        'Could not queue email. Please retry.',
      );
      throw error;
    }
    return { data: null, message: 'Exact saved variation queued for email' };
  }

  @Post(':id/sent')
  @Roles('SUPER_ADMIN')
  async sent(
    @Param('id') id: string,
    @Body() dto: SubmissionReferenceDto,
    @Req() req: Request,
  ) {
    return {
      data: await this.variations.confirmSent(
        id,
        dto.reference,
        (req.user as AuthUser).userId,
      ),
      message:
        'Submission recorded. These instructions will not repeat unless they change.',
    };
  }
}
