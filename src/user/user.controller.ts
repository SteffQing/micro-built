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
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthUser } from 'src/common/types';
import { ApiUnauthorizedResponse } from 'src/common/decorators';
import { ApiUserResponse } from './common/decorators';
import { UpdatePasswordDto, UpdateUserDto } from './common/dto';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    // private readonly identityService: IdentityService,
    // private readonly loansService: LoansService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiUserResponse()
  @ApiUnauthorizedResponse()
  async getProfile(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const user = await this.userService.getUserById(userId);
    return {
      message: `Profile data for ${user.name} has been successfully queried`,
      data: { user },
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiUserResponse()
  @ApiUnauthorizedResponse()
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const { userId } = req.user as AuthUser;
    const user = await this.userService.updateUser(userId, updateUserDto);
    return {
      message: `Profile for ${user.name} has been successfully updated`,
      data: { user },
    };
  }

  @Patch('password')
  @ApiOperation({ summary: 'Update user password' })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Password has been successfully updated',
        },
      },
    },
  })
  @ApiUnauthorizedResponse()
  async updatePassword(
    @Req() req: Request,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    const { userId } = req.user as AuthUser;
    await this.userService.updatePassword(userId, updatePasswordDto);
    return {
      message: 'Password has been successfully updated',
    };
  }

  // // --- Overview ---
  // @Get('overview')
  // @ApiOperation({ summary: 'Get user dashboard overview' })
  // async getOverview(@Req() req: Request) {
  //   return this.userService.getOverview(req.user.id);
  // }

  // // --- Identity Sub-Controller ---
  // @Get('identity')
  // @ApiOperation({ summary: 'Get identity verification status' })
  // async getIdentity(@Req() req: Request) {
  //   return this.identityService.getStatus(req.user.id);
  // }

  // @Post('identity')
  // @ApiOperation({ summary: 'Submit identity verification' })
  // async submitIdentity(@Req() req: Request, @Body() identityData: any) {
  //   return this.identityService.submitVerification(req.user.id, identityData);
  // }

  // @Patch('identity')
  // @ApiOperation({ summary: 'Update identity information' })
  // async updateIdentity(@Req() req: Request, @Body() identityData: any) {
  //   return this.identityService.updateVerification(req.user.id, identityData);
  // }

  // // --- Loans Controller ---
  // @Get('loans')
  // @ApiOperation({ summary: 'Get user loans' })
  // async getLoans(@Req() req: Request) {
  //   return this.loansService.getUserLoans(req.user.id);
  // }

  // @Post('loans/apply')
  // @ApiOperation({ summary: 'Apply for a new loan' })
  // async applyForLoan(@Req() req: Request, @Body() applicationData: any) {
  //   return this.loansService.applyForLoan(req.user.id, applicationData);
  // }

  // @Get('loans/:id')
  // @ApiOperation({ summary: 'Get loan details' })
  // async getLoan(@Req() req: Request, @Param('id') loanId: string) {
  //   return this.loansService.getLoanDetails(req.user.id, loanId);
  // }

  // @Get('repayments')
  // @ApiOperation({ summary: 'Get repayment history' })
  // async getRepayments(@Req() req: Request) {
  //   return this.loansService.getRepaymentHistory(req.user.id);
  // }

  // @Get('repayments/:loanId')
  // @ApiOperation({ summary: 'Get repayment details for a loan' })
  // async getLoanRepayments(
  //   @Req() req: Request,
  //   @Param('loanId') loanId: string,
  // ) {
  //   return this.loansService.getLoanRepayments(req.user.id, loanId);
  // }
}
