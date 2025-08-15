import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const BYPASS_KEY = 'bypassMaintenance';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const BypassMaintenance = () => SetMetadata(BYPASS_KEY, true);
