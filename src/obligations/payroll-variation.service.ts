import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PayrollVariationBatch,
  PayrollVariationRow,
} from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { generateId, parsePeriodToDate } from 'src/common/utils';
import {
  canonicalPeriod,
  calculatePlanPeriodSnapshot,
  money,
  stableHash,
} from './repayment-plan.logic';
import { RepaymentObligationService } from './repayment-obligation.service';
import {
  VariationScheduleMode,
  PayrollVariationFilter,
} from 'src/common/types/report.interface';
import {
  calculatePayrollVariation,
  payrollChangeTypes,
  filterPayrollVariation,
  PayrollInstruction,
  PreviousPayrollInstruction,
  payrollInstructionIsActive,
} from './payroll-variation.logic';

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;
type Tx = Prisma.TransactionClient;
type Batch = PayrollVariationBatch & { rows: PayrollVariationRow[] };
const includeRows = { rows: { orderBy: { externalId: 'asc' as const } } };
const EVENT_REASONS: Record<string, string> = {
  ADVANCE_DISBURSED: 'New loan disbursed',
  TOPUP_DISBURSED: 'Top-up disbursed',
  TENURE_CHANGE_APPROVED: 'Tenure changed',
  LIQUIDATION_APPLIED: 'Liquidation applied',
  INSTALLMENT_DEFAULTED: 'Default and repayment terms revised',
  PENALTY_WAIVER: 'Penalty waived',
  PENALTY_REVERSAL: 'Penalty reversed',
};

@Injectable()
export class PayrollVariationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly obligations: RepaymentObligationService,
  ) {}

  private async lock(tx: Tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(713209086)`;
  }

  private rowInstruction(row: PayrollVariationRow): PreviousPayrollInstruction {
    return {
      id: row.id,
      action: row.action,
      borrowerId: row.borrowerId,
      obligationId: row.obligationId,
      installmentId: row.installmentId,
      planId: row.planId,
      externalId: row.externalId,
      borrowerName: row.borrowerName,
      command: row.command,
      termRemaining: row.termRemaining,
      sourceEventIds: row.sourceEventIds,
      changeTypes: row.changeTypes,
      reasons: row.reasons,
      amount: row.amount.toFixed(2),
      contractualOutstanding: row.contractualOutstanding.toFixed(2),
      penaltyOutstanding: row.penaltyOutstanding.toFixed(2),
      totalOutstanding: row.totalOutstanding.toFixed(2),
      effectiveFromPeriod: row.effectiveFromPeriod.toISOString(),
      endDate: row.endDate?.toISOString() ?? null,
    };
  }

  serialize(batch: Batch) {
    return {
      ...batch,
      period: this.periodLabel(batch.period),
      rows: batch.rows.map((row) => ({
        ...this.rowInstruction(row),
        previousAmount: row.previousAmount?.toFixed(2) ?? null,
      })),
      totalAmount: batch.rows
        .reduce((total, row) => total.add(row.amount), money(0))
        .toFixed(2),
    };
  }

  private periodLabel(period: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Lagos',
    })
      .format(period)
      .toUpperCase();
  }

  async state() {
    const [setup, pending, history, legacySchedules] = await Promise.all([
      this.prisma.payrollVariationState.findUnique({ where: { id: 'FG' } }),
      this.prisma.payrollVariationBatch.findFirst({
        where: { status: 'PREPARED' },
        include: includeRows,
      }),
      this.prisma.payrollVariationBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: includeRows,
      }),
      this.prisma.payrollSchedule.findMany({
        where: { publishedAt: { not: null } },
        orderBy: [{ period: 'desc' }, { version: 'desc' }],
        take: 36,
        select: {
          id: true,
          period: true,
          version: true,
          rowCount: true,
          publicationNote: true,
        },
      }),
    ]);
    return {
      initialized: !!setup,
      setup,
      pending: pending ? this.serialize(pending) : null,
      history: history.map((item) => this.serialize(item)),
      legacySchedules: legacySchedules.map((item) => ({
        ...item,
        period: this.periodLabel(item.period),
      })),
    };
  }

  async initialize(
    input: {
      scheduleId?: string;
      noPriorInstructions?: boolean;
      reference: string;
    },
    actorId: string,
  ) {
    if (!input.reference?.trim())
      throw new BadRequestException('A baseline reference is required');
    if (!!input.scheduleId === !!input.noPriorInstructions) {
      throw new BadRequestException(
        'Select a previously sent schedule or confirm there are no prior payroll instructions',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      if (await tx.payrollVariationState.findUnique({ where: { id: 'FG' } }))
        throw new ConflictException(
          'Payroll submission history is already initialized',
        );
      let baselineBatchId: string | null = null;
      if (input.scheduleId) {
        const schedule = await tx.payrollSchedule.findUnique({
          where: { id: input.scheduleId },
          include: {
            rows: {
              include: {
                installment: { include: { plan: true } },
                obligation: { include: { events: true } },
              },
            },
          },
        });
        if (!schedule?.publishedAt)
          throw new BadRequestException(
            'Choose an existing official schedule that was actually submitted',
          );
        baselineBatchId = generateId.anyId('VAR', 10);
        await tx.payrollVariationBatch.create({
          data: {
            id: baselineBatchId,
            period: schedule.period,
            version: 1,
            kind: 'BASELINE',
            status: 'SENT',
            previewHash: stableHash({
              scheduleId: schedule.id,
              rowIds: schedule.rows.map((row) => row.id),
            }),
            preparedBy: actorId,
            sentBy: actorId,
            sentAt: new Date(),
            submissionReference: input.reference.trim(),
            note: 'Operator confirmed this historical schedule was already submitted',
            sourceScheduleId: schedule.id,
            rows: {
              create: schedule.rows.map((row) => ({
                id: generateId.anyId('VR', 10),
                borrowerId: row.borrowerId,
                obligationId: row.obligationId,
                installmentId: row.installmentId,
                planId: row.installment.planId,
                action: 'START',
                reasons: ['Confirmed historical submission'],
                sourceEventIds: row.obligation.events
                  .filter(
                    (event) =>
                      event.sequence <= row.installment.plan.inputEventSequence,
                  )
                  .map((event) => event.id),
                externalId: row.externalId,
                borrowerName: row.borrowerName,
                command: row.command,
                amount: row.amount,
                contractualOutstanding: row.contractualOutstanding,
                penaltyOutstanding: row.penaltyOutstanding,
                totalOutstanding: row.totalOutstanding,
                termRemaining: row.termRemaining,
                effectiveFromPeriod: schedule.period,
                endDate: row.endDate,
                instructionHash: row.rowHash,
              })),
            },
          },
        });
      }
      await tx.payrollVariationState.create({
        data: {
          id: 'FG',
          initializedBy: actorId,
          reference: input.reference.trim(),
          baselineBatchId,
        },
      });
      return { initialized: true, baselineBatchId };
    }, TX_OPTIONS);
  }

  private async buildPreview(
    tx: Tx,
    period: Date,
    changeFilter = PayrollVariationFilter.ALL,
  ) {
    if (!Object.values(PayrollVariationFilter).includes(changeFilter))
      throw new BadRequestException('Invalid payroll change filter');
    if (!(await tx.payrollVariationState.findUnique({ where: { id: 'FG' } }))) {
      throw new ConflictException(
        'Confirm the payroll submission baseline before preparing a variation',
      );
    }
    const closed = await tx.config.findUnique({
      where: { key: 'LAST_REPAYMENT_DATE' },
    });
    if (closed && period <= canonicalPeriod(new Date(closed.value))) {
      throw new ConflictException(
        'This repayment month is closed. Re-download its saved submission from history',
      );
    }
    const latestSent = await tx.payrollVariationBatch.findFirst({
      where: { status: 'SENT' },
      orderBy: [{ period: 'desc' }, { version: 'desc' }],
    });
    if (latestSent && period < latestSent.period)
      throw new ConflictException(
        'New variations must not precede the latest confirmed payroll submission',
      );
    const pending = await tx.payrollVariationBatch.findFirst({
      where: { status: 'PREPARED' },
      select: { id: true },
    });
    if (pending)
      throw new ConflictException(
        `Confirm or re-download prepared variation ${pending.id} before preparing another`,
      );

    const sentRows = await tx.payrollVariationRow.findMany({
      where: {
        batch: { status: 'SENT' },
        effectiveFromPeriod: { lte: period },
      },
      orderBy: [{ batch: { period: 'desc' } }, { batch: { version: 'desc' } }],
    });
    const previousByBorrower = new Map<string, PreviousPayrollInstruction>();
    for (const row of sentRows)
      if (!previousByBorrower.has(row.borrowerId))
        previousByBorrower.set(row.borrowerId, this.rowInstruction(row));
    const installments = await tx.repaymentInstallment.findMany({
      where: {
        period,
        status: { in: ['PLANNED', 'PUBLISHED', 'PARTIAL', 'PAID', 'MISSED'] },
        plan: { status: { in: ['PUBLISHED', 'SUPERSEDED'] } },
      },
      include: {
        plan: { include: { installments: { orderBy: { sequence: 'asc' } } } },
        obligation: {
          include: {
            borrower: { include: { payroll: true } },
            events: { orderBy: { sequence: 'asc' } },
          },
        },
      },
      orderBy: { obligation: { borrowerId: 'asc' } },
    });
    const knownObligations = await tx.repaymentObligation.findMany({
      where: {
        id: {
          in: [...previousByBorrower.values()].map((row) => row.obligationId),
        },
      },
      include: {
        borrower: { include: { payroll: true } },
        events: { orderBy: { sequence: 'asc' } },
      },
    });
    const unplannedLoans = await tx.loan.findMany({
      where: { status: 'DISBURSED', obligationAdvance: null },
      select: { borrowerId: true, borrower: { select: { name: true } } },
      distinct: ['borrowerId'],
    });
    const desired = new Map<string, PayrollInstruction>();
    const issues: { borrowerId: string; name: string; message: string }[] =
      unplannedLoans.map((loan) => ({
        borrowerId: loan.borrowerId,
        name: loan.borrower.name,
        message:
          'Legacy loan needs repayment-obligation backfill before payroll can be prepared',
      }));
    for (const installment of installments) {
      const { obligation, plan } = installment;
      const borrower = obligation.borrower;
      const stopFrom =
        obligation.payrollStopFromPeriod ??
        (obligation.settledAt ? canonicalPeriod(obligation.settledAt) : null);
      if (
        ['SETTLED', 'CLOSED'].includes(obligation.status) &&
        stopFrom &&
        stopFrom <= period
      ) {
        continue;
      }
      if (obligation.status === 'SUSPENDED') {
        issues.push({
          borrowerId: borrower.id,
          name: borrower.name,
          message:
            'Repayment obligation is suspended; review its payroll instruction',
        });
        continue;
      }
      if (!borrower.externalId || !borrower.payroll) {
        issues.push({
          borrowerId: borrower.id,
          name: borrower.name,
          message: 'Missing IPPIS number or payroll information',
        });
        continue;
      }
      if (desired.has(borrower.id))
        throw new ConflictException(
          `Multiple current installments for ${borrower.name}`,
        );
      const previous = previousByBorrower.get(borrower.id);
      if (previous && previous.externalId !== borrower.externalId) {
        issues.push({
          borrowerId: borrower.id,
          name: borrower.name,
          message:
            'IPPIS number differs from the last submission; reconcile the previous deduction first',
        });
      }
      const relevantEvents = obligation.events.filter(
        (event) => event.sequence <= plan.inputEventSequence,
      );
      const priorEvents = new Set(previous?.sourceEventIds ?? []);
      const reasons = relevantEvents
        .filter(
          (event) => !priorEvents.has(event.id) && EVENT_REASONS[event.type],
        )
        .map((event) => EVENT_REASONS[event.type]);
      const snapshot = calculatePlanPeriodSnapshot({
        termMonths: plan.termMonths,
        currentSequence: installment.sequence,
        installments: plan.installments,
      });
      desired.set(borrower.id, {
        borrowerId: borrower.id,
        obligationId: obligation.id,
        installmentId: installment.id,
        planId: plan.id,
        externalId: borrower.externalId,
        borrowerName: borrower.name,
        command: borrower.payroll.command,
        amount: installment.totalExpected.toFixed(2),
        contractualOutstanding: snapshot.contractualOutstanding.toFixed(2),
        penaltyOutstanding: snapshot.penaltyOutstanding.toFixed(2),
        totalOutstanding: snapshot.contractualOutstanding
          .add(snapshot.penaltyOutstanding)
          .toFixed(2),
        termRemaining: snapshot.termRemaining,
        effectiveFromPeriod: period.toISOString(),
        endDate: snapshot.endDate.toISOString(),
        sourceEventIds: relevantEvents.map((event) => event.id),
        changeTypes: payrollChangeTypes(
          relevantEvents
            .filter((event) => !priorEvents.has(event.id))
            .map((event) => event.type),
        ),
        reasons,
      });
    }
    for (const previous of previousByBorrower.values()) {
      if (
        desired.has(previous.borrowerId) ||
        !payrollInstructionIsActive(previous, period)
      )
        continue;
      const obligation = knownObligations.find(
        (item) => item.id === previous.obligationId,
      );
      const stopFrom =
        obligation?.payrollStopFromPeriod ??
        (obligation?.settledAt ? canonicalPeriod(obligation.settledAt) : null);
      if (
        obligation &&
        ['SETTLED', 'CLOSED'].includes(obligation.status) &&
        stopFrom &&
        stopFrom <= period
      ) {
        const priorEvents = new Set(previous.sourceEventIds);
        const instruction: PayrollInstruction = {
          borrowerId: previous.borrowerId,
          obligationId: previous.obligationId,
          installmentId: null,
          planId: null,
          externalId: previous.externalId,
          borrowerName: previous.borrowerName,
          command: previous.command,
          amount: '0.00',
          contractualOutstanding: '0.00',
          penaltyOutstanding: '0.00',
          totalOutstanding: '0.00',
          termRemaining: 0,
          effectiveFromPeriod: period.toISOString(),
          endDate: null,
          sourceEventIds: [],
          changeTypes: [],
          reasons: [],
        };
        desired.set(previous.borrowerId, {
          ...instruction,
          installmentId: null,
          planId: null,
          amount: '0.00',
          contractualOutstanding: '0.00',
          penaltyOutstanding: '0.00',
          totalOutstanding: '0.00',
          termRemaining: 0,
          effectiveFromPeriod: period.toISOString(),
          endDate: null,
          sourceEventIds: obligation.events.map((event) => event.id),
          changeTypes: payrollChangeTypes(
            obligation.events
              .filter((event) => !priorEvents.has(event.id))
              .map((event) => event.type),
          ),
          reasons: [
            'Stop deduction: loan settled',
            ...obligation.events
              .filter(
                (event) =>
                  !priorEvents.has(event.id) && EVENT_REASONS[event.type],
              )
              .map((event) => EVENT_REASONS[event.type]),
          ],
        });
      } else {
        issues.push({
          borrowerId: previous.borrowerId,
          name: previous.borrowerName,
          message:
            'Previously submitted deduction has no current installment or completed stop instruction',
        });
      }
    }
    const allRows = calculatePayrollVariation(
      [...desired.values()],
      [...previousByBorrower.values()],
      period,
    );
    const rows = filterPayrollVariation(allRows, changeFilter);
    const counts = {
      start: rows.filter((row) => row.action === 'START').length,
      amend: rows.filter((row) => row.action === 'AMEND').length,
      stop: rows.filter((row) => row.action === 'STOP').length,
    };
    return {
      period: this.periodLabel(period),
      periodDate: period,
      changeFilter,
      totalChangeCount: allRows.length,
      excludedCount: allRows.length - rows.length,
      rows,
      issues,
      counts,
      totalAmount: rows
        .reduce((sum, row) => sum.add(row.amount), money(0))
        .toFixed(2),
      unchangedCount:
        [...desired.values()].filter((row) => money(row.amount).gt(0)).length -
        allRows.filter((row) => row.action !== 'STOP').length,
      previewHash: stableHash({
        period,
        latestSent: latestSent?.id ?? null,
        changeFilter,
        desired: [...desired.values()],
        rows,
        issues,
      }),
    };
  }

  async backfill(period: string) {
    await this.preview(period); // Enforce setup, open-month and pending-submission checks.
    return this.obligations.backfillActiveObligations(
      parsePeriodToDate(period),
    );
  }

  async preview(period: string, changeFilter = PayrollVariationFilter.ALL) {
    return this.prisma.$transaction(
      (tx) =>
        this.buildPreview(
          tx,
          canonicalPeriod(parsePeriodToDate(period)),
          changeFilter,
        ),
      TX_OPTIONS,
    );
  }

  async prepare(
    input: {
      period: string;
      mode?: VariationScheduleMode;
      email: string;
      previewHash: string;
      changeFilter?: PayrollVariationFilter;
      submissionNote?: string;
    },
    actorId: string,
  ) {
    const official = input.mode === VariationScheduleMode.SUBMIT;
    if (official && !input.submissionNote?.trim())
      throw new BadRequestException('A submission reason is required');
    return this.prisma
      .$transaction(async (tx) => {
        await this.lock(tx);
        const period = canonicalPeriod(parsePeriodToDate(input.period));
        const preview = await this.buildPreview(tx, period, input.changeFilter);
        if (preview.previewHash !== input.previewHash)
          throw new ConflictException(
            'Payroll terms changed after preview. Refresh and review the variation again',
          );
        if (preview.issues.length)
          throw new BadRequestException(
            'Resolve the payroll issues shown in the preview before generating a variation',
          );
        // An empty category is not a no-change month. No batch or internal
        // freeze is created until the operator reviews All changes instead.
        if (
          !preview.rows.length &&
          preview.changeFilter !== PayrollVariationFilter.ALL
        ) {
          throw new BadRequestException(
            `No customers match this filter. ${preview.excludedCount} other customer changes await submission. Select All changes to review the month`,
          );
        }
        const latest = await tx.payrollVariationBatch.findFirst({
          where: { period },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        // Keep the full monthly snapshot even when the external variation is empty
        // or contains only stop instructions. It freezes every recurring deduction.
        const internal = official
          ? await this.obligations.prepareVariationSchedule(
              input.period,
              actorId,
              VariationScheduleMode.SUBMIT,
              input.submissionNote,
              { tx, allowEmpty: true, reuseOfficial: true },
            )
          : null;
        const noChanges = preview.rows.length === 0;
        const batch = await tx.payrollVariationBatch.create({
          data: {
            id: generateId.anyId('VAR', 10),
            period,
            version: (latest?.version ?? 0) + 1,
            status: official ? (noChanges ? 'SENT' : 'PREPARED') : 'DRAFT',
            kind: noChanges ? 'NO_CHANGES' : 'VARIATION',
            previewHash: preview.previewHash,
            changeFilter: preview.changeFilter,
            excludedCount: preview.excludedCount,
            preparedBy: actorId,
            recipientEmail: input.email,
            note: input.submissionNote?.trim(),
            internalScheduleId: internal?.scheduleId,
            ...(official && noChanges
              ? {
                  sentAt: new Date(),
                  sentBy: actorId,
                  submissionReference:
                    'Month finalized: no payroll changes to send',
                }
              : {}),
            rows: {
              create: preview.rows.map((row) => ({
                ...row,
                id: generateId.anyId('VR', 10),
              })),
            },
          },
          include: includeRows,
        });
        return this.serialize(batch);
      }, TX_OPTIONS)
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          throw new ConflictException(
            'Another payroll or loan update occurred. Refresh the variation preview and try again',
          );
        }
        throw error;
      });
  }

  async getBatch(id: string) {
    const batch = await this.prisma.payrollVariationBatch.findUnique({
      where: { id },
      include: includeRows,
    });
    if (!batch) throw new NotFoundException('Payroll variation not found');
    return batch;
  }

  async confirmSent(id: string, reference: string, actorId: string) {
    if (!reference.trim())
      throw new BadRequestException(
        'Enter the reference for the submission actually sent',
      );
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      const batch = await tx.payrollVariationBatch.findUnique({
        where: { id },
        include: includeRows,
      });
      if (!batch) throw new NotFoundException('Payroll variation not found');
      if (batch.status === 'SENT') return this.serialize(batch);
      if (batch.status !== 'PREPARED')
        throw new ConflictException('A draft cannot be confirmed as sent');
      if (!batch.artifactHash || !batch.emailedAt)
        throw new ConflictException(
          'Generate and deliver the prepared file before confirming its submission',
        );
      // A recorded bounce means nobody received this file. Confirming it would
      // put a submission on record that never actually happened.
      if (batch.emailError)
        throw new ConflictException(
          `This file did not reach its recipient. ${batch.emailError}`,
        );
      const saved = await tx.payrollVariationBatch.update({
        where: { id },
        data: {
          status: 'SENT',
          sentBy: actorId,
          sentAt: new Date(),
          submissionReference: reference.trim(),
        },
        include: includeRows,
      });
      return this.serialize(saved);
    }, TX_OPTIONS);
  }

  async setArtifact(id: string, hash: string, url: string) {
    const updated = await this.prisma.payrollVariationBatch.updateMany({
      where: { id, OR: [{ artifactHash: null }, { artifactHash: hash }] },
      data: { artifactHash: hash, artifactUrl: url },
    });
    if (updated.count !== 1)
      throw new ConflictException(
        'Variation file differs from its saved version',
      );
  }

  async recordEmail(
    id: string,
    error?: string,
    messageId?: string,
    recipient?: string,
  ) {
    await this.prisma.payrollVariationBatch.update({
      where: { id },
      data: error
        ? { emailError: error }
        : {
            emailedAt: new Date(),
            emailError: null,
            // A resend starts a fresh delivery. Never carry over the previous
            // attempt's confirmation, and record where it actually went so the
            // reported recipient cannot go stale.
            emailDeliveredAt: null,
            emailMessageId: messageId ?? null,
            ...(recipient ? { recipientEmail: recipient } : {}),
          },
    });
  }

  // Resend accepts any syntactically valid address, so a misspelled domain is
  // only discovered when the provider reports the bounce. Without this the
  // batch would keep claiming the file was emailed successfully.
  async recordDelivery(
    messageId: string,
    event: 'delivered' | 'bounced' | 'complained',
    detail?: string,
  ) {
    const batch = await this.prisma.payrollVariationBatch.findFirst({
      where: { emailMessageId: messageId },
      select: { id: true },
    });
    if (!batch) return null;
    await this.prisma.payrollVariationBatch.update({
      where: { id: batch.id },
      data:
        event === 'delivered'
          ? { emailDeliveredAt: new Date(), emailError: null }
          : {
              emailDeliveredAt: null,
              emailError:
                event === 'bounced'
                  ? `Delivery failed: the address was rejected${detail ? ` (${detail})` : ''}. Correct it and email the saved copy again.`
                  : `The recipient marked this message as spam${detail ? ` (${detail})` : ''}. Confirm they received the file before recording the submission.`,
            },
    });
    return batch.id;
  }
}
