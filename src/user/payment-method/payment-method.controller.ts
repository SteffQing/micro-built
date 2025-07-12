import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentMethodService } from './payment-method.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../common/dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request } from 'express';
import { AuthUser } from 'src/common/types';
import { ApiOkBaseResponse } from 'src/common/decorators';
import { UserPaymentMethodDto } from '../common/entities';

@ApiTags('User Payment Method')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/payment-method')
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Post()
  @ApiOperation({ summary: 'Add new payment method for a user' })
  @ApiCreatedResponse({
    description: 'Payment method successfully created',
    schema: {
      example: {
        message: 'Payment method has been successfully created and added!',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'User not verified or not logged in',
  })
  @ApiConflictResponse({ description: 'Payment method already exists' })
  @ApiUnprocessableEntityResponse({
    description: 'Account name does not match identity',
  })
  async createUserPaymentMethod(
    @Req() req: Request,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    const { userId } = req.user as AuthUser;
    const message = await this.paymentMethodService.addPaymentMethod(
      userId,
      dto,
    );
    return { message };
  }

  @Patch()
  @ApiOperation({ summary: 'Update user’s existing payment method' })
  @ApiOkResponse({
    description: 'Payment method successfully updated',
    schema: {
      example: {
        message: 'Payment method has been successfully updated.',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'User not verified or not logged in',
  })
  @ApiNotFoundResponse({ description: 'No payment method found for this user' })
  @ApiUnprocessableEntityResponse({
    description: 'Updated account name does not match identity',
  })
  async updateUserPaymentMethod(
    @Req() req: Request,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    const { userId } = req.user as AuthUser;
    const message = await this.paymentMethodService.updatePaymentMethod(
      userId,
      dto,
    );
    return { message };
  }

  @Get()
  @ApiOperation({ summary: 'Get user’s payment method info' })
  @ApiOkBaseResponse(UserPaymentMethodDto)
  @ApiNotFoundResponse({ description: 'No payment method found for this user' })
  async getUserPaymentMethod(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const data = await this.paymentMethodService.getPaymentMethod(userId);
    return { data, message: 'Payment methods have been successfully queried' };
  }
}
