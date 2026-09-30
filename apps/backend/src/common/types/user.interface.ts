import type { AdminRole, UserStatus, UserType } from '@prisma/client';

/** CUSTOMER, or the admin's role. */
export type AccessRole = AdminRole | 'CUSTOMER';

/** The signed-in user as the AccessGuard puts it on `req.user` (read it with @CurrentUser()). */
export interface AuthUser {
  userId: string;
  type: UserType;
  role: AccessRole;
  /** null when the account only has a placeholder address (phone-only customers). */
  email: string | null;
  status: UserStatus;
  twoFactorEnabled: boolean;
}
