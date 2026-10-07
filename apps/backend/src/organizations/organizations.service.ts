import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ChangeRequestsService } from 'src/change-requests/change-requests.service';
import type { OrganizationSwitchResultDto } from 'src/change-requests/change-requests.dto';
import { captureJobError } from 'src/common/observability';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { LedgerTx } from 'src/ledger/ledger.tx';
import { lagosMonthOf } from 'src/ledger/period';
import { AdminNotifierService, NOTIFICATION_SUBJECT } from 'src/notifications/admin-notifier.service';
import type { MergedOrganizationsDto, OrganizationDto } from './organizations.dto';
import { mergeBlocker, organizationPayrollStates } from './organizations';

// Organizations as admins manage them (PLAN_V2 §2): where each stands, merging a misspelt one into the right one, and
// proposing to move customers between them (a change request a super admin approves).
@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly clock: LedgerClock,
    private readonly changeRequests: ChangeRequestsService,
    private readonly adminNotifier: AdminNotifierService,
  ) {}

  /** Every organization, A–Z, with its customers, running loans and where its payroll stands. */
  async list(): Promise<OrganizationDto[]> {
    const now = lagosMonthOf(this.clock.now());
    const [states, payrolls, running, thisMonth] = await Promise.all([
      organizationPayrollStates(this.prisma, now),
      this.prisma.customerPayroll.groupBy({ by: ['organizationId'], _count: { _all: true } }),
      this.prisma.$queryRaw<{ organizationId: string; loans: number }[]>`
        SELECT cp."organizationId", COUNT(*)::int AS "loans"
        FROM "Loan" l
        JOIN "Customer" c ON c."userId" = l."borrowerId"
        JOIN "CustomerPayroll" cp ON cp."externalId" = c."externalId"
        WHERE l."status" = 'DISBURSED'
        GROUP BY cp."organizationId"`,
      this.prisma.$queryRaw<{ organizationId: string }[]>`
        SELECT DISTINCT cp."organizationId"
        FROM "Deduction" d
        JOIN "Period" p ON p."id" = d."periodId"
        JOIN "Loan" l ON l."id" = d."loanId"
        JOIN "Customer" c ON c."userId" = l."borrowerId"
        JOIN "CustomerPayroll" cp ON cp."externalId" = c."externalId"
        WHERE p."year" = ${now.year} AND p."month" = ${now.month}::"Month"`,
    ]);
    const customers = new Map(payrolls.map((row) => [row.organizationId, row._count._all]));
    const loans = new Map(running.map((row) => [row.organizationId, row.loans]));
    const active = new Set(thisMonth.map((row) => row.organizationId));
    return states.map((state) => ({
      id: state.id,
      name: state.name,
      customers: customers.get(state.id) ?? 0,
      runningLoans: loans.get(state.id) ?? 0,
      latestLocked: state.latestLocked,
      unlocked: state.unlocked,
      deductionsThisMonth: active.has(state.id),
    }));
  }

  /**
   * Folds a misspelt organization into the right one: its payroll records and its variations (with their vouchers)
   * move, and it is deleted. Refused when the merged organization couldn't stay consistent (`mergeBlocker`): both have
   * a variation for the same month (two files went to payroll for it), or the move would leave a variation behind a
   * locked one or deductions no generation could take. Pending organization changes follow: one into the merged
   * organization now points at the one that stays, and one the merge has made pointless (the customer is already
   * there) is withdrawn.
   */
  async merge(sourceId: string, intoId: string, actorId: string): Promise<MergedOrganizationsDto> {
    if (sourceId === intoId) throw new BadRequestException('An organization can’t be merged into itself');

    const { result, withdrawn } = await this.ledgerTx.transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "Organization" WHERE "id" IN (${Prisma.join([sourceId, intoId])}) ORDER BY "id" FOR UPDATE`;
      const [source, into] = await Promise.all([
        tx.organization.findUnique({ where: { id: sourceId }, select: { id: true, name: true } }),
        tx.organization.findUnique({ where: { id: intoId }, select: { id: true, name: true } }),
      ]);
      if (!source || !into) throw new NotFoundException('Organization not found');

      const variations = await tx.variation.findMany({
        where: { organizationId: { in: [sourceId, intoId] } },
        select: {
          organizationId: true,
          noPayrollReason: true,
          voucher: { select: { id: true } },
          period: { select: { year: true, month: true } },
        },
      });
      const earliestOpen = (organizationId: string) =>
        tx.deduction
          .findFirst({
            where: { status: 'OPEN', loan: { borrower: { payroll: { organizationId } } } },
            orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
            select: { period: { select: { year: true, month: true } } },
          })
          .then((open) => open?.period ?? null);
      const blocker = mergeBlocker({
        source,
        into,
        variations: variations.map((v) => ({
          organizationId: v.organizationId,
          period: v.period,
          locked: v.voucher !== null || v.noPayrollReason !== null,
        })),
        earliestOpen: { source: await earliestOpen(sourceId), into: await earliestOpen(intoId) },
      });
      if (blocker) throw new ConflictException(blocker);

      const { count: movedPayrolls } = await tx.customerPayroll.updateMany({
        where: { organizationId: sourceId },
        data: { organizationId: intoId },
      });
      const { count: movedVariations } = await tx.variation.updateMany({
        where: { organizationId: sourceId },
        data: { organizationId: intoId },
      });

      const withdrawn: string[] = [];
      const pending = await tx.changeRequest.findMany({
        where: { kind: 'ORGANIZATION', status: 'PENDING' },
        select: { id: true, userId: true, proposed: true, previous: true },
      });
      if (pending.length) {
        const owners = await tx.customer.findMany({
          where: { userId: { in: pending.map((p) => p.userId) } },
          select: { userId: true, payroll: { select: { organizationId: true } } },
        });
        const current = new Map(owners.map((owner) => [owner.userId, owner.payroll?.organizationId ?? null]));
        const stays = { organizationId: intoId, organization: into.name };
        for (const request of pending) {
          const proposed = request.proposed as { organizationId?: string };
          const previous = request.previous as { organizationId?: string };
          const target = proposed.organizationId === sourceId ? intoId : proposed.organizationId;
          if (target === current.get(request.userId)) {
            await tx.changeRequest.update({
              where: { id: request.id },
              data: { status: 'CANCELLED', note: `${source.name} was merged into ${into.name}` },
            });
            withdrawn.push(request.id);
          } else if (proposed.organizationId === sourceId || previous.organizationId === sourceId) {
            await tx.changeRequest.update({
              where: { id: request.id },
              data: {
                ...(proposed.organizationId === sourceId && { proposed: { ...proposed, ...stays } }),
                ...(previous.organizationId === sourceId && { previous: { ...previous, ...stays } }),
              },
            });
          }
        }
      }

      await tx.organization.delete({ where: { id: sourceId } });
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'ORGANIZATIONS_MERGED',
        entityType: 'ORGANIZATION',
        entityId: intoId,
        note:
          `${source.name} (${sourceId}) merged into ${into.name}: ${movedPayrolls} payroll records, ` +
          `${movedVariations} variations${withdrawn.length ? `, ${withdrawn.length} pending changes withdrawn` : ''}`,
      });
      return { result: { intoId, movedPayrolls, movedVariations }, withdrawn };
    });

    for (const id of withdrawn) {
      void this.adminNotifier.clear(NOTIFICATION_SUBJECT.changeRequest(id)).catch((error: unknown) => {
        this.logger.error('Clearing a withdrawn change prompt failed', error instanceof Error ? error.stack : error);
        captureJobError(error, { job: 'organizations.merge.clear-prompt' });
      });
    }
    return result;
  }

  /** Change requests moving these customers (by external id) into the organization, for a super admin to approve. */
  requestSwitches(organizationId: string, externalIds: string[], actorId: string): Promise<OrganizationSwitchResultDto[]> {
    return this.changeRequests.proposeOrganization(organizationId, externalIds, actorId);
  }
}
