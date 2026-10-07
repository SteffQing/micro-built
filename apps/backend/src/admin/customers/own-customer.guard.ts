import { Injectable, NotFoundException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from 'src/database/prisma.service';
import type { AuthUser } from 'src/common/types';
import { CUSTOMER_NOT_FOUND } from './customer.service';

/**
 * A marketer only reaches the customers they onboarded (their account officer is the marketer): anyone else's
 * `/admin/customer/:id/...` answers 404, as if there were no such customer. Admins and super admins pass. Runs after
 * the global AccessGuard, which puts the user on the request.
 */
@Injectable()
export class OwnCustomerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    const id = request.params?.id;
    if (user?.role !== 'MARKETER' || typeof id !== 'string') return true;
    const own = await this.prisma.customer.findFirst({
      where: { userId: id, accountOfficerId: user.userId },
      select: { userId: true },
    });
    if (!own) throw new NotFoundException(CUSTOMER_NOT_FOUND);
    return true;
  }
}
