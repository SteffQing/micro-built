import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
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
import {
  FilterRepaymentsDto,
  ManualRepaymentResolutionDto,
  UploadRepaymentReportDto,
} from '../common/dto';
import {
  ApiNullOkResponse,
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AuthUser } from 'src/common/types';

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

  @Post('upload')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Upload repayment report for a specific period',
    description:
      'Upload an Excel spreadsheet containing repayment data for a specific period (e.g., "APRIL 2025")',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel spreadsheet file (.xlsx, .xls)',
        },
        period: {
          type: 'string',
          description: 'Repayment period (e.g., "APRIL 2025")',
          example: 'APRIL 2025',
        },
      },
      required: ['file', 'period'],
    },
  })
  @ApiNullOkResponse(
    'File uploaded successfully',
    'Repayment has been queued for processing',
    true,
  )
  @ApiBadRequestResponse({
    description: 'Invalid file type, no file provided, or missing period',
    schema: {
      examples: {
        invalidFileType: {
          value: {
            statusCode: 400,
            message:
              'Invalid file type. Only Excel files (.xlsx, .xls) are allowed',
            error: 'Bad Request',
          },
        },
        missingFile: {
          value: {
            statusCode: 400,
            message: 'No file provided',
            error: 'Bad Request',
          },
        },
        missingPeriod: {
          value: {
            statusCode: 400,
            message: 'Period is required',
            error: 'Bad Request',
          },
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Invalid file type. Only Excel files (.xlsx, .xls) are allowed',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadRepaymentReportDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.service.uploadRepaymentDocument(file, dto.period);
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

  @Patch(':id/manual-resolution')
  @ApiOperation({
    summary: 'Manually resolve a repayment',
    description:
      'Manually marks a repayment as resolved — typically used when an automated deduction fails.',
  })
  @ApiNullOkResponse(
    'Loan repayment manually set successfully',
    'Repayment status has been manually resolved!',
  )
  @ApiRoleForbiddenResponse()
  resolveRepayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ManualRepaymentResolutionDto,
  ) {
    const { userId } = req.user as AuthUser;
    return this.service.manuallyResolveRepayment(id, dto, userId);
  }

  @Patch(':id/reject-liquidation')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Reject a liquidation',
    description: 'Marks a liquidation as rejected by an admin or reviewer.',
  })
  @ApiNullOkResponse(
    'Liquidation rejected successfully',
    'The liquidation has been marked as rejected.',
  )
  @ApiRoleForbiddenResponse()
  rejectLiquidation(@Param('id') id: string) {
    return this.service.rejectLiqudationRequest(id);
  }

  @Patch(':id/accept-liquidation')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Accept a liquidation',
    description:
      'Marks a liquidation as accepted and proceeds with resolution.',
  })
  @ApiNullOkResponse(
    'Liquidation accepted successfully',
    'Liquidation request has been accepted and queued for processing',
  )
  @ApiRoleForbiddenResponse()
  acceptLiquidation(@Param('id') id: string) {
    return this.service.acceptLiquidationRequest(id);
  }
}
