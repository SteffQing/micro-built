import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Req,
  Get,
  Patch,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AuthUser } from 'src/common/types';
import { Request } from 'express';
import { IdentityService } from './identity.service';
import { CreateIdentityDto, UpdateIdentityDto } from '../common/dto';
import { ApiOkBaseResponse } from 'src/common/decorators';
import { UserIdentityDto } from '../common/entities';

@ApiTags('User Identity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document for identity verification' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'File uploaded successfully',
    schema: {
      example: {
        message: 'passport.pdf has been successfully uploaded!',
        data: {
          url: 'https://xyz.supabase.co/storage/identity-bucket/userid/passport.pdf',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid file type or no file provided',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid file type',
        error: 'Bad Request',
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Invalid file type'), false);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const { userId } = req.user as AuthUser;
    return this.identityService.uploadFile(file, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get the current user’s identity verification documents',
  })
  @ApiOkBaseResponse(UserIdentityDto)
  async getUserIdentityInfo(@Req() req: Request) {
    const { userId } = req.user as AuthUser;
    const identityInfo = await this.identityService.getIdentityInfo(userId);
    return {
      message: identityInfo
        ? 'Identity information for the user has been retrieved successfully'
        : 'Identity information not found for this user',
      data: identityInfo,
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Submit identity verification data for the first time',
  })
  @ApiBody({ type: CreateIdentityDto })
  @ApiCreatedResponse({
    description: 'Identity successfully submitted',
    schema: {
      example: {
        message:
          'Your identity documents have been successfully created! Please wait as we manually review this information',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Identity already exists',
    schema: {
      example: {
        statusCode: 400,
        message: 'You have already submitted your identity verification.',
        error: 'Bad Request',
      },
    },
  })
  async submitVerification(
    @Req() req: Request,
    @Body() dto: CreateIdentityDto,
  ) {
    const { userId } = req.user as AuthUser;
    const message = await this.identityService.submitVerification(userId, dto);
    return {
      message,
    };
  }

  @Patch()
  @ApiOperation({
    summary: 'Update previously submitted identity verification data',
  })
  @ApiBody({ type: UpdateIdentityDto })
  @ApiOkResponse({
    description: 'Identity updated successfully',
    schema: {
      example: {
        message:
          'Your identity documents have been successfully updated! Please wait as we manually review this new information',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Identity record not found',
    schema: {
      example: {
        statusCode: 404,
        message:
          'Identity record not found. Please submit your verification first.',
        error: 'Not Found',
      },
    },
  })
  async updateVerification(
    @Req() req: Request,
    @Body() dto: UpdateIdentityDto,
  ) {
    const { userId } = req.user as AuthUser;
    const message = await this.identityService.updateVerification(userId, dto);
    return {
      message,
    };
  }
}
