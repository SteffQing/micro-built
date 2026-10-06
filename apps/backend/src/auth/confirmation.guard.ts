import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import { CONFIRMATION_HEADER, ConfirmationsService } from './confirmations.service';
import { CONFIRM_KEY, type ConfirmRule } from './decorators';

type ConfirmRequest = Request & { user?: AuthUser; session?: { session?: { id?: string } } };

/** The session id AccessGuard put on the request, and the confirmation token the client sent. */
export function confirmationOf(request: ConfirmRequest): { sessionId?: string; token?: string } {
  const header = request.headers[CONFIRMATION_HEADER];
  const query = request.query?.confirmation;
  const token = (Array.isArray(header) ? header[0] : header) ?? (typeof query === 'string' ? query : undefined);
  return { sessionId: request.session?.session?.id, token: token || undefined };
}

/** Runs after AccessGuard (auth.module.ts registers it second): routes marked @Confirm(mode) need a fresh confirmation. */
@Injectable()
export class ConfirmationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly confirmations: ConfirmationsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const rule = this.reflector.getAllAndOverride<ConfirmRule | undefined>(CONFIRM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule) return true;
    const request = context.switchToHttp().getRequest<ConfirmRequest>();
    if (!request.user) return true; // AccessGuard already refused anyone signed out
    if (rule.when && !(await rule.when(request, this.prisma))) return true;
    const { sessionId, token } = confirmationOf(request);
    await this.confirmations.assert(request.user, sessionId, token, rule.mode);
    return true;
  }
}
