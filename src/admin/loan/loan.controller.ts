// --- loan.controller.ts ---
import {
  Controller,
  Get,
  Query,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  Body,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  AcceptCommodityLoanDto,
  CashLoanItemDto,
  CashLoanQueryDto,
  CommodityLoanItemDto,
  CommodityLoanQueryDto,
  LoanTermsDto,
} from '../common/dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CashLoanService, CommodityLoanService } from './loan.service';
import { ResponseDto } from 'src/common/dto';

@ApiTags('Cash Loans')
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
    type: ResponseDto<CashLoanItemDto>,
    description: 'List of cash loans',
  })
  async getAll(@Query() query: CashLoanQueryDto) {
    return this.loanService.getAllLoans(query);
  }

  @Post(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Disburse loan',
    description:
      'Disburses a loan after it has been approved. Only accessible by SUPER_ADMIN.',
  })
  @ApiResponse({ status: 204, description: 'Loan disbursed successfully' })
  async disburseLoan(@Param('id') loanId: string) {
    await this.loanService.disburseLoan(loanId);
    return { message: 'Loan disbursed successfully' };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Approve loan',
    description: 'Approves a loan after it has been accepted by the customer.',
  })
  @ApiResponse({ status: 204, description: 'Loan approved successfully' })
  async approveLoan(@Param('id') loanId: string) {
    await this.loanService.approveLoan(loanId);
    return { message: 'Loan approved successfully' };
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set loan terms',
    description:
      'Set the loan terms for tenure, amountRepayable and pushes the data for the user to review',
  })
  @ApiResponse({ status: 204, description: 'Loan terms set successfully' })
  async setLoanTerms(@Param('id') loanId: string, @Body() dto: LoanTermsDto) {
    await this.loanService.setLoanTerms(loanId, dto);
    return { message: 'Loan terms set successfully' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reject loan',
    description: 'Rejects a loan',
  })
  @ApiResponse({ status: 204, description: 'Loan rejected successfully' })
  async rejectLoan(@Param('id') loanId: string) {
    await this.loanService.rejectLoan(loanId);
    return { message: 'Loan rejected successfully' };
  }
}

@ApiTags('Commodity Loans')
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
  @ApiResponse({ status: 200, type: ResponseDto<CommodityLoanItemDto> })
  getAll(@Query() query: CommodityLoanQueryDto) {
    return this.loanService.getAllLoans(query);
  }

  @Patch(':id')
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
  async approveLoan(
    @Param('id') loanId: string,
    @Body() dto: AcceptCommodityLoanDto,
  ) {
    const res = await this.loanService.approveCommodityLoan(loanId, dto);
    return res;
  }

  @Put(':id')
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
