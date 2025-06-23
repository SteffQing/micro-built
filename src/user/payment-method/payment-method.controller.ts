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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request } from 'express';
import { AuthUser } from 'src/common/types';

@ApiTags('User Payment Method')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/payment-method')
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Post()
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
  async getUserPaymentMethod(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const data = await this.paymentMethodService.getPaymentMethod(userId);
    return { data, message: 'Payment methods have been successfully queried' };
  }
}
