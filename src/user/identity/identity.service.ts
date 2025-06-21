import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string) {
    const userIdentity = await this.prisma.userIdentity.findUnique({
      where: { userId },
    });
    if (!userIdentity) {
      throw new NotFoundException(
        'Identity verification not found for this user',
      );
    }

    return userIdentity;
  }

  async submitVerification(userId: string, identityData: any) {
    return {
      status: 'SUBMITTED',
      message: 'Identity verification submitted successfully',
      data: {
        userId,
        verificationStatus: 'SUBMITTED',
        submittedAt: new Date(),
        documents: identityData,
      },
    };
  }

  async updateVerification(userId: string, identityData: any) {
    // TODO: Implement identity verification update
    // This should handle updates to existing identity verification
    // information and documents
    return {
      status: 'UPDATED',
      message: 'Identity verification updated successfully',
      data: {
        userId,
        verificationStatus: 'UPDATED',
        updatedAt: new Date(),
        documents: identityData,
      },
    };
  }
}
