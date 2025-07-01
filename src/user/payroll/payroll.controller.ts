import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto, UpdatePayrollDto, PayrollDto } from '../common/dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiUserNotFoundResponse } from '../common/decorators';
import { ApiUserUnauthorizedResponse } from '../common/decorators';
import { ResponseDto } from 'src/common/dto';
import { ApiGenericErrorResponse } from 'src/common/decorators';
import { AuthUser } from 'src/common/types';
import { Request } from 'express';

@ApiTags('User Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @ApiOperation({ summary: 'Get user payroll data' })
  @ApiOkResponse({
    type: ResponseDto<PayrollDto | null>,
    description: 'User payroll data retrieved successfully',
  })
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  async getPayroll(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.payrollService.getPayroll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create user payroll data' })
  @ApiOkResponse({
    type: ResponseDto<null>,
    description: 'User payroll data created successfully',
  })
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  @ApiGenericErrorResponse({
    msg: 'User or IPPIS ID not found',
    code: 404,
    err: 'NotFound',
    desc: 'The provided IPPIS ID does not map to an existing user',
  })
  async createPayroll(@Body() dto: CreatePayrollDto) {
    return this.payrollService.createPayroll(dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user payroll data' })
  @ApiOkResponse({
    type: ResponseDto<null>,
    description: 'User payroll data updated successfully',
  })
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  @ApiGenericErrorResponse({
    msg: 'User or IPPIS ID not found',
    code: 404,
    err: 'NotFound',
    desc: 'The provided IPPIS ID does not map to an existing user',
  })
  @ApiGenericErrorResponse({
    msg: 'User payroll data not found',
    code: 404,
    err: 'NotFound',
    desc: 'No payroll data found for the user',
  })
  async updatePayroll(@Req() req: Request, @Body() dto: UpdatePayrollDto) {
    const { userId } = req.user as AuthUser;
    return this.payrollService.updatePayroll(userId, dto);
  }
}
