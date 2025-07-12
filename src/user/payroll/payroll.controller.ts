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
import { CreatePayrollDto, UpdatePayrollDto } from '../common/dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiUserNotFoundResponse } from '../common/decorators';
import { ApiUserUnauthorizedResponse } from '../common/decorators';
import {
  ApiGenericErrorResponse,
  ApiOkBaseResponse,
} from 'src/common/decorators';
import { AuthUser } from 'src/common/types';
import { Request } from 'express';
import { UserPayrollDto } from '../common/entities';

@ApiTags('User Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @ApiOperation({ summary: 'Get user payroll data' })
  @ApiOkBaseResponse(UserPayrollDto)
  @ApiUserNotFoundResponse()
  @ApiUserUnauthorizedResponse()
  async getPayroll(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    return this.payrollService.getPayroll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create user payroll data' })
  @ApiCreatedResponse({
    description: 'User payroll data created successfully',
    schema: {
      example: {
        message: 'User payroll data created',
        data: null,
      },
    },
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
  @ApiCreatedResponse({
    description: 'User payroll data updated successfully',
    schema: {
      example: {
        message: 'User payroll data updated',
        data: null,
      },
    },
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
