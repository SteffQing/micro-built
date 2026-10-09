import { Injectable } from '@nestjs/common';
import type { ToolSet } from 'ai';
import { CustomerService } from 'src/admin/customers/customer.service';
import { CustomersService } from 'src/admin/customers/customers.service';
import { CashLoanService } from 'src/admin/loan/loan.service';
import { VariationsAdminService } from 'src/admin/variations/variations.service';
import { ChangeRequestsService } from 'src/change-requests/change-requests.service';
import { PrismaService } from 'src/database/prisma.service';
import { LiquidationRequestsService } from 'src/liquidations/liquidation-requests.service';
import { MarketerService } from 'src/marketer/marketer.service';
import { InappService } from 'src/notifications/inapp.service';
import { LoanService } from 'src/user/loan/loan.service';
import { RepaymentsService } from 'src/user/repayments/repayments.service';
import { UserService } from 'src/user/user.service';
import type { SupportCaller } from '../caller';
import type { Topic } from '../guard/questions';
import { adminTools, type AdminToolDeps } from './admin';
import { customerTools, type CustomerToolDeps } from './customer';
import { marketerTools, type MarketerToolDeps } from './marketer';

// Which tools the reply model gets (CHAT_SUPPORT.md §1.4): the audience's set, narrowed by the guard's topic (fewer
// tools: fewer tokens and less to misuse). Visitors and restricted callers get none.

const CUSTOMER_TOPICS: Partial<Record<Topic, string[]>> = {
  loan: ['my_loan', 'my_overview'],
  repayments: ['my_deductions', 'my_repayments'],
  liquidation: ['my_liquidations', 'my_loan'],
  topup: ['my_loan'],
  commodity: ['my_asset_requests'],
  account: ['my_overview', 'my_change_requests', 'my_payment_method', 'my_notifications'],
};

const MARKETER_TOPICS: Partial<Record<Topic, string[]>> = {
  loan: ['find_my_customers', 'customer_summary', 'my_portfolio'],
  repayments: ['find_my_customers', 'customer_deductions', 'my_portfolio'],
  liquidation: ['find_my_customers', 'customer_summary'],
  topup: ['find_my_customers', 'my_topups', 'customer_summary'],
  commodity: ['find_my_customers', 'my_asset_requests'],
  account: ['find_my_customers', 'customer_summary'],
};

const ADMIN_TOPICS: Partial<Record<Topic, string[]>> = {
  loan: ['find_customers', 'customer_summary', 'loan_details'],
  repayments: ['find_customers', 'customer_deductions', 'org_variation_status'],
  liquidation: ['find_customers', 'customer_summary', 'loan_details'],
  topup: ['find_customers', 'customer_summary', 'loan_details'],
  commodity: ['find_customers', 'customer_summary'],
  account: ['find_customers', 'customer_summary', 'my_customers', 'list_admins'],
};

/** The tools for a topic: the narrowed list when it has one (how_to, contact, staff_ops and other get them all). */
export function narrow<T extends ToolSet>(tools: T, topics: Partial<Record<Topic, string[]>>, topic: Topic): ToolSet {
  const names = topics[topic];
  if (!names) return tools;
  return Object.fromEntries(Object.entries(tools).filter(([name]) => names.includes(name)));
}

@Injectable()
export class SupportToolsService {
  private readonly customerDeps: CustomerToolDeps;
  private readonly marketerDeps: MarketerToolDeps;
  private readonly adminDeps: AdminToolDeps;

  constructor(
    prisma: PrismaService,
    users: UserService,
    loans: LoanService,
    repayments: RepaymentsService,
    liquidations: LiquidationRequestsService,
    changeRequests: ChangeRequestsService,
    notifications: InappService,
    customers: CustomersService,
    customer: CustomerService,
    marketer: MarketerService,
    cashLoans: CashLoanService,
    variations: VariationsAdminService,
  ) {
    this.customerDeps = { users, loans, repayments, liquidations, changeRequests, notifications };
    const staff = { prisma, customers, customer, repayments };
    this.marketerDeps = { ...staff, marketer };
    this.adminDeps = { ...staff, cashLoans, variations };
  }

  /** The caller's identity comes from the session, never from the model: it is closed over here. */
  toolsFor(caller: SupportCaller, topic: Topic): ToolSet {
    if (!caller.user || caller.restricted) return {};
    const userId = caller.user.userId;
    switch (caller.audience) {
      case 'CUSTOMER':
        return narrow(customerTools(this.customerDeps, userId), CUSTOMER_TOPICS, topic);
      case 'MARKETER':
        return narrow(marketerTools(this.marketerDeps, userId), MARKETER_TOPICS, topic);
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return narrow(adminTools(this.adminDeps, userId, caller.audience === 'SUPER_ADMIN'), ADMIN_TOPICS, topic);
      default:
        return {};
    }
  }
}
