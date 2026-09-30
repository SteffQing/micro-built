import {
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SettingsService } from 'src/settings/settings.service';
import { BYPASS_MAINTENANCE_KEY } from './decorators';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** In maintenance mode only reads go through, plus routes marked @BypassMaintenance(). */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly settings: SettingsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (READS.has(request.method.toUpperCase())) return true;
    if (this.reflector.getAllAndOverride<boolean>(BYPASS_MAINTENANCE_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }
    if (await this.settings.inMaintenance()) {
      throw new ServiceUnavailableException('MicroBuilt is under maintenance. Please try again later.');
    }
    return true;
  }
}
