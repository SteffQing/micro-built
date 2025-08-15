import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from 'src/config/config.service';
import { BYPASS_KEY } from './roles.decorator';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method.toUpperCase();

    if (method === 'GET') return true;

    const bypassMaintenance = this.reflector.get<boolean>(
      BYPASS_KEY,
      context.getHandler(),
    );
    if (bypassMaintenance) return true;

    const inMaintenance = await this.config.inMaintenanceMode();
    if (inMaintenance) {
      throw new ServiceUnavailableException(
        'MicroBuilt is under maintenance. Please try again later.',
      );
    }

    return true;
  }
}
