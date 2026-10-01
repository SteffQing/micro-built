import { BadRequestException, Injectable } from '@nestjs/common';
import { comparePeriods, periodLabel, type Period } from '@microbuilt/shared';
import { parsePeriodRange } from 'src/common/dto/period.dto';
import type { AuthUser } from 'src/common/types';
import type { DocumentKind, ReportAudience } from 'src/common/types/queue.interface';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { lagosMonthOf } from 'src/ledger/period';
import { StatementService } from 'src/ledger/statement.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import type { DocumentRequestDto } from './statements.dto';

export const NO_LOAN_TO_REPORT = 'There is no disbursed loan to report on yet';

type Statement = Awaited<ReturnType<StatementService['lines']>>;

export interface StatementPage {
  data: Omit<Statement, 'lines'> & { from: string; to: string; lines: Statement['lines'] };
  meta: { total: number; page: number; limit: number };
}

// Statements on screen (paged JSON) and as files (queued, D11), for the customer's own copy and
// the admin's. The lines themselves come from the ledger (StatementService).
@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statements: StatementService,
    private readonly clock: LedgerClock,
    private readonly queue: QueueProducer,
  ) {}

  /** `from` defaults to the first disbursement month, `to` to the current Lagos month. */
  async range(customerId: string, query: { from?: string; to?: string }): Promise<{ from: Period; to: Period }> {
    const range = parsePeriodRange(query);
    const to = range.to ?? lagosMonthOf(this.clock.now());
    if (range.from) return { from: range.from, to };
    const first = await this.prisma.loan.findFirst({
      where: { borrowerId: customerId, status: { in: ['DISBURSED', 'REPAID'] }, disbursementDate: { not: null } },
      orderBy: { disbursementDate: 'asc' },
      select: { disbursementDate: true },
    });
    const firstMonth = first?.disbursementDate ? lagosMonthOf(first.disbursementDate) : to;
    return { from: comparePeriods(firstMonth, to) > 0 ? to : firstMonth, to };
  }

  /** Totals cover the whole range; `lines` is one page, oldest first. */
  async page(
    customerId: string,
    query: { from?: string; to?: string; page?: number; limit?: number },
    audience: ReportAudience,
  ): Promise<StatementPage> {
    const range = await this.range(customerId, query);
    const statement = await this.statements.lines({ customerId }, range, audience);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return {
      data: {
        ...statement,
        from: periodLabel(range.from),
        to: periodLabel(range.to),
        lines: statement.lines.slice(start, start + limit),
      },
      meta: { total: statement.lines.length, page, limit },
    };
  }

  /**
   * Queues the file. It reaches the requester in-app, and by email at `dto.email` or the
   * requester's own address (phone-only customers get it in-app only).
   */
  async request(
    customerId: string,
    kind: DocumentKind,
    dto: DocumentRequestDto,
    requester: AuthUser,
    audience: ReportAudience,
  ): Promise<{ jobId: string }> {
    parsePeriodRange(dto);
    const disbursed = await this.prisma.loan.count({
      where: { borrowerId: customerId, disbursementDate: { not: null } },
    });
    if (!disbursed) throw new BadRequestException(NO_LOAN_TO_REPORT);
    return this.queue.generateCustomerReport({
      customerId,
      email: dto.email ?? requester.email ?? undefined,
      requestedById: requester.userId,
      audience,
      kind,
      format: dto.format ?? 'pdf',
      from: dto.from,
      to: dto.to,
    });
  }
}
