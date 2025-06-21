import {
  Controller,
  Get,
  Patch,
  UseGuards,
  Req,
  Body,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly identityService: IdentityService,
    private readonly loansService: LoansService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: Request) {
    return this.userService.getProfile(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Req() req: Request, @Body() updateUserDto: any) {
    return this.userService.updateProfile(req.user.id, updateUserDto);
  }

  // --- Password ---
  @Patch('password')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(req.user.id, changePasswordDto);
  }

  // --- Settings ---
  @Get('settings')
  @ApiOperation({ summary: 'Get user settings' })
  async getSettings(@Req() req: Request) {
    return this.userService.getSettings(req.user.id);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update notification settings' })
  async updateSettings(
    @Req() req: Request,
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    return this.userService.updateSettings(req.user.id, updateSettingsDto);
  }

  // --- Overview ---
  @Get('overview')
  @ApiOperation({ summary: 'Get user dashboard overview' })
  async getOverview(@Req() req: Request) {
    return this.userService.getOverview(req.user.id);
  }

  // --- Identity Sub-Controller ---
  @Get('identity')
  @ApiOperation({ summary: 'Get identity verification status' })
  async getIdentity(@Req() req: Request) {
    return this.identityService.getStatus(req.user.id);
  }

  @Post('identity')
  @ApiOperation({ summary: 'Submit identity verification' })
  async submitIdentity(@Req() req: Request, @Body() identityData: any) {
    return this.identityService.submitVerification(req.user.id, identityData);
  }

  @Patch('identity')
  @ApiOperation({ summary: 'Update identity information' })
  async updateIdentity(@Req() req: Request, @Body() identityData: any) {
    return this.identityService.updateVerification(req.user.id, identityData);
  }

  // --- Loans Controller ---
  @Get('loans')
  @ApiOperation({ summary: 'Get user loans' })
  async getLoans(@Req() req: Request) {
    return this.loansService.getUserLoans(req.user.id);
  }

  @Post('loans/apply')
  @ApiOperation({ summary: 'Apply for a new loan' })
  async applyForLoan(@Req() req: Request, @Body() applicationData: any) {
    return this.loansService.applyForLoan(req.user.id, applicationData);
  }

  @Get('loans/:id')
  @ApiOperation({ summary: 'Get loan details' })
  async getLoan(@Req() req: Request, @Param('id') loanId: string) {
    return this.loansService.getLoanDetails(req.user.id, loanId);
  }

  @Get('repayments')
  @ApiOperation({ summary: 'Get repayment history' })
  async getRepayments(@Req() req: Request) {
    return this.loansService.getRepaymentHistory(req.user.id);
  }

  @Get('repayments/:loanId')
  @ApiOperation({ summary: 'Get repayment details for a loan' })
  async getLoanRepayments(
    @Req() req: Request,
    @Param('loanId') loanId: string,
  ) {
    return this.loansService.getLoanRepayments(req.user.id, loanId);
  }
}
