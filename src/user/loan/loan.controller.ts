import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@ApiTags('User Loan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/loan')
export class LoanController {}
