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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CashLoanItemDto,
  CashLoanQueryDto,
  CommodityLoanItemDto,
  CommodityLoanQueryDto,
} from '../common/dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CashLoanService, CommodityLoanService } from './loan.service';
import { ResponseDto } from 'src/common/dto';

@ApiTags('Cash Loans')
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

  @Post(':id/disburse')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Disburse loan',
    description:
      'Disburses a loan after it has been approved. Only accessible by SUPER_ADMIN.',
  })
  @ApiResponse({ status: 204, description: 'Loan disbursed successfully' })
  disburseLoan(@Param('id') loanId: string) {
    return this.loanService.disburseLoan(loanId);
  }
}

@ApiTags('Commodity Loans')
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
}
