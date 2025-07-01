import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  AcceptCommodityLoanDto,
  CashLoanDto,
  CashLoanItemsDto,
  CashLoanQueryDto,
  CommodityLoanDto,
  CommodityLoanItemsDto,
  CommodityLoanQueryDto,
  LoanTermsDto,
} from '../common/dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CashLoanService, CommodityLoanService } from './loan.service';
import { ApiRoleForbiddenResponse } from '../common/decorators';

@ApiTags('Admin:Cash Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/loans/cash')
export class CashLoanController {
  constructor(private readonly loanService: CashLoanService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all cash loans',
    description: 'Returns paginated list of cash loans filtered by status',
  })
  @ApiResponse({
    status: 200,
    type: CashLoanItemsDto,
    description: 'List of cash loans',
  })
  @ApiRoleForbiddenResponse()
  async getAll(@Query() query: CashLoanQueryDto) {
    return this.loanService.getAllLoans(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get loan details',
    description: 'Returns details of a specific cash loan by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Loan details retrieved successfully',
        },
        data: {
          oneOf: [{ $ref: getSchemaPath(CashLoanDto) }, { type: 'null' }],
        },
      },
    },
  })
  @ApiRoleForbiddenResponse()
  async getLoan(@Param('id') loanId: string) {
    const loan = await this.loanService.getLoan(loanId);
    return {
      data: loan,
      message: 'Loan details retrieved successfully',
    };
  }

  @Patch(':id/disburse')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Disburse loan',
    description:
      'Disburses a loan after it has been approved. Only accessible by SUPER_ADMIN.',
  })
  @ApiResponse({ status: 204, description: 'Loan disbursed successfully' })
  @ApiRoleForbiddenResponse()
  async disburseLoan(@Param('id') loanId: string) {
    await this.loanService.disburseLoan(loanId);
    return { message: 'Loan disbursed successfully' };
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Approve loan',
    description: 'Approves a loan after it has been accepted by the customer.',
  })
  @ApiResponse({ status: 204, description: 'Loan approved successfully' })
  @ApiRoleForbiddenResponse()
  async approveLoan(@Param('id') loanId: string) {
    await this.loanService.approveLoan(loanId);
    return { message: 'Loan approved successfully' };
  }

  @Patch(':id/terms')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set loan terms',
    description:
      'Set the loan terms for tenure, amountRepayable and pushes the data for the user to review',
  })
  @ApiResponse({ status: 204, description: 'Loan terms set successfully' })
  @ApiRoleForbiddenResponse()
  async setLoanTerms(@Param('id') loanId: string, @Body() dto: LoanTermsDto) {
    await this.loanService.setLoanTerms(loanId, dto);
    return { message: 'Loan terms set successfully' };
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reject loan',
    description: 'Rejects a loan',
  })
  @ApiResponse({ status: 204, description: 'Loan rejected successfully' })
  @ApiRoleForbiddenResponse()
  async rejectLoan(@Param('id') loanId: string) {
    await this.loanService.rejectLoan(loanId);
    return { message: 'Loan rejected successfully' };
  }
}

@ApiTags('Admin:Commodity Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/loans/commodity')
export class CommodityLoanController {
  constructor(private readonly loanService: CommodityLoanService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all commodity loans',
    description:
      'Returns paginated list of commodity loans optionally filtered by name or review status',
  })
  @ApiResponse({ status: 200, type: CommodityLoanItemsDto })
  @ApiRoleForbiddenResponse()
  getAll(@Query() query: CommodityLoanQueryDto) {
    return this.loanService.getAllLoans(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get loan details',
    description: 'Returns details of a specific commodity loan by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Loan details retrieved successfully',
        },
        data: {
          oneOf: [{ $ref: getSchemaPath(CommodityLoanDto) }, { type: 'null' }],
        },
      },
    },
  })
  @ApiRoleForbiddenResponse()
  async getLoan(@Param('id') loanId: string) {
    const loan = await this.loanService.getLoan(loanId);
    return {
      data: loan,
      message: 'Loan details retrieved successfully',
    };
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Approve Commodity loan',
    description:
      'Approves a commodity loan and initializes a cash loan model for it.',
  })
  @ApiResponse({
    status: 204,
    description:
      'Commodity Loan has been approved and a corresponding cash loan, initiated!',
  })
  @ApiRoleForbiddenResponse()
  async approveLoan(
    @Param('id') loanId: string,
    @Body() dto: AcceptCommodityLoanDto,
  ) {
    const res = await this.loanService.approveCommodityLoan(loanId, dto);
    return res;
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reject Commodity Loan',
    description:
      'Rejects a commodity loan, initializes a cash loan model but rejects it instantly too',
  })
  @ApiResponse({
    status: 204,
    description: 'Commodity Loan has been rejected!',
  })
  async rejectLoan(@Param('id') loanId: string) {
    const res = await this.loanService.rejectCommodityLoan(loanId);
    return res;
  }
}
