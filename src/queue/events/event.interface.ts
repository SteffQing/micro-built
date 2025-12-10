import { Prisma } from '@prisma/client';
import { CustomerLoanRequest } from 'src/admin/common/dto';

export interface UserLoanCreateEvent {
  id: string;
  userId: string;
  interestPerAnnum: number;
  managementFeeRate: number;
  requestedBy?: string;
}

export interface UserCommodityLoanCreateEvent {
  assetName: string;
  id: string;
  userId: string;
  requestedBy?: string;
}

export interface AdminInviteEvent {
  adminId: string;
  existing: {
    id: string;
  } | null;
}

export interface AdminResolveRepaymentEvent {
  id: string;
  note: string;
}

export interface AdminLoanTopup {
  dto: CustomerLoanRequest;
  userId: string;
  adminId: string;
}
