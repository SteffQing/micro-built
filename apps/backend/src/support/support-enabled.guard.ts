import { Injectable, ServiceUnavailableException, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { supportEnabled } from './support.service';

const ALWAYS_KEY = 'supportAlways';

/** Answers even with support switched off (GET /support/session says `enabled: false`). */
export const SupportAlwaysOn = () => SetMetadata(ALWAYS_KEY, true);

/** SUPPORT_ENABLED=false (C14): every support route but the session answers 503, so the frontend falls back to email. */
@Injectable()
export class SupportEnabledGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (supportEnabled()) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALWAYS_KEY, [context.getHandler(), context.getClass()])) return true;
    throw new ServiceUnavailableException('Chat support is switched off. Email the team instead.');
  }
}
