import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { CreateIdentityDto, UpdateIdentityDto } from '../common/dto';

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async getIdentityInfo(userId: string) {
    const userIdentity = await this.prisma.userIdentity.findUnique({
      where: { userId },
      select: {
        documents: true,
        dateOfBirth: true,
        nextOfKinContact: true,
        nextOfKinName: true,
        nextOfKinAddress: true,
        nextOfKinRelationship: true,
        residencyAddress: true,
        stateResidency: true,
        gender: true,
        landmarkOrBusStop: true,
        maritalStatus: true,
      },
    });
    return userIdentity;
  }

  async uploadFile(file: Express.Multer.File, userId: string) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const url = await this.supabase.uploadIdentityDoc(file, userId);

    return {
      data: { url },
      message: `${file.originalname} has been successfully uploaded!`,
    };
  }

  async submitVerification(userId: string, dto: CreateIdentityDto) {
    const existing = await this.prisma.userIdentity.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestException(
        'You have already submitted your identity verification.',
      );
    }
    await this.prisma.userIdentity.create({ data: { ...dto, userId } });
    return 'Your identity documents have been successfully created! Please wait as we manually review this information';
  }

  async updateVerification(userId: string, dto: UpdateIdentityDto) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { userId },
    });

    if (!identity) {
      throw new NotFoundException(
        'Identity record not found. Please submit your verification first.',
      );
    }
    await this.prisma.userIdentity.update({
      where: { userId },
      data: { ...dto },
    });
    return 'Your identity documents have been successfully updated! Please wait as we manually review this new information';
  }
}
