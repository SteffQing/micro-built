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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  AcceptCommodityLoanDto,
  CashLoanQueryDto,
  CommodityLoanQueryDto,
  LoanTermsDto,
} from '../common/dto';
import {
  CashLoanItemDto,
  CommodityLoanItemDto,
  CashLoanDto,
  CommodityLoanDto,
  CustomerUserId,
} from '../common/entities';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CashLoanService, CommodityLoanService } from './loan.service';
import { ApiRoleForbiddenResponse } from '../common/decorators';
import {
  ApiOkBaseResponse,
  ApiOkPaginatedResponse,
} from 'src/common/decorators';

@ApiTags('Admin:Cash Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/loans/cash')
export class CashLoanController {
  constructor(private readonly loanService: CashLoanService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all cash loans',
    description: 'Returns paginated list of cash loans filtered by status',
  })
  @ApiOkPaginatedResponse(CashLoanItemDto)
  @ApiRoleForbiddenResponse()
  async getAll(@Query() query: CashLoanQueryDto) {
    return this.loanService.getAllLoans(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get loan details',
    description: 'Returns details of a specific cash loan by its ID',
  })
  @ApiOkBaseResponse(CashLoanDto)
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disburse loan',
    description:
      'Disburses a loan after it has been approved. Only accessible by SUPER_ADMIN.',
  })
  @ApiOkBaseResponse(CustomerUserId)
  @ApiRoleForbiddenResponse()
  async disburseLoan(@Param('id') loanId: string) {
    return this.loanService.disburseLoan(loanId);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set loan terms',
    description:
      'Set the loan terms for tenure, amountRepayable and pushes the data for the user to review',
  })
  @ApiOkBaseResponse(CustomerUserId)
  @ApiRoleForbiddenResponse()
  async approveLoan(@Param('id') loanId: string, @Body() dto: LoanTermsDto) {
    return this.loanService.approveLoan(loanId, dto);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject loan',
    description: 'Rejects a loan',
  })
  @ApiOkBaseResponse(CustomerUserId)
  @ApiRoleForbiddenResponse()
  async rejectLoan(@Param('id') loanId: string) {
    return this.loanService.rejectLoan(loanId);
  }
}

@ApiTags('Admin:Commodity Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/loans/commodity')
export class CommodityLoanController {
  constructor(private readonly loanService: CommodityLoanService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all commodity loans',
    description:
      'Returns paginated list of commodity loans optionally filtered by name or review status',
  })
  @ApiOkPaginatedResponse(CommodityLoanItemDto)
  @ApiRoleForbiddenResponse()
  getAll(@Query() query: CommodityLoanQueryDto) {
    return this.loanService.getAllLoans(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get loan details',
    description: 'Returns details of a specific commodity loan by its ID',
  })
  @ApiOkBaseResponse(CommodityLoanDto)
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
  @ApiOkBaseResponse(CustomerUserId)
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
  @ApiOkBaseResponse(CustomerUserId)
  @ApiRoleForbiddenResponse()
  async rejectLoan(@Param('id') loanId: string) {
    const res = await this.loanService.rejectCommodityLoan(loanId);
    return res;
  }
}
