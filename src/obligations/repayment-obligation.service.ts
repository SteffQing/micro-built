import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EventActorType,
  InstallmentStatus,
  PlanReason,
  PlanStatus,
  Prisma,
} from '@prisma/client';
import { differenceInCalendarMonths } from 'date-fns';
import {
  generateId,
  parseDateToPeriod,
  parsePeriodToDate,
} from 'src/common/utils';
import { logic } from 'src/common/logic/repayment.logic';
import { PrismaService } from 'src/database/prisma.service';
import {
  calculateFuturePlanBalances,
  calculateRepaymentPlan,
  canonicalPeriod,
  money,
  nextPayrollPeriod,
  PlanPolicyName,
  stableHash,
} from './repayment-plan.logic';
import {
  CreateTenureChangeRequestDto,
  PenaltyAdjustmentDto,
  TenureChangePreviewDto,
} from './dto/tenure-change.dto';

type Tx = Prisma.TransactionClient;

const FINANCIAL_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

interface Actor {
  id: string;
  type: EventActorType;
}

interface PlanPublicationInput {
  obligationId: string;
  scheduledBalance: Prisma.Decimal;
  penaltyBalance: Prisma.Decimal;
  termMonths: number;
  effectiveFrom: Date;
  reason: PlanReason;
  policyName: PlanPolicyName;
  policyVersion: string;
  actor: Actor;
  triggerEventSequence: bigint;
  snapshot: Record<string, unknown>;
}

export interface VariationScheduleRow {
  scheduleRowId: string;
  installmentId: string;
  obligationId: string;
  externalId: string;
  name: string;
  command: string;
  contractualOutstanding: number;
  penaltyOutstanding: number;
  totalOutstanding: number;
  expected: number;
  tenure: number;
  start: Date;
  end: Date;
}

@Injectable()
export class RepaymentObligationService {
  constructor(private readonly prisma: PrismaService) {}

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private async nextUnpublishedPeriodInTx(tx: Tx, after: Date) {
    const candidate = nextPayrollPeriod(after);
    const latestPublished = await tx.payrollSchedule.findFirst({
      where: { status: 'PUBLISHED', period: { gte: candidate } },
      orderBy: { period: 'desc' },
      select: { period: true },
    });
    return latestPublished
      ? nextPayrollPeriod(latestPublished.period)
      : candidate;
  }

  private async nextUnpublishedPeriod(after: Date) {
    const candidate = nextPayrollPeriod(after);
    const latestPublished = await this.prisma.payrollSchedule.findFirst({
      where: { status: 'PUBLISHED', period: { gte: candidate } },
      orderBy: { period: 'desc' },
      select: { period: true },
    });
    return latestPublished
      ? nextPayrollPeriod(latestPublished.period)
      : candidate;
  }

  private async balancesAvailableForFuturePlan(
    db: Pick<Tx, 'repaymentInstallment'>,
    obligationId: string,
    effectiveFrom: Date,
    contractualOutstanding: Prisma.Decimal,
    penaltyOutstanding: Prisma.Decimal,
  ) {
    const frozenInstallments = await db.repaymentInstallment.findMany({
      where: {
        obligationId,
        period: { lt: canonicalPeriod(effectiveFrom) },
        closedAt: null,
        status: {
          in: [InstallmentStatus.PUBLISHED, InstallmentStatus.PARTIAL],
        },
      },
      include: {
        allocations: {
          select: { component: true, amount: true },
        },
      },
    });
    const frozen = frozenInstallments.reduce(
      (total, installment) => {
        const contractualPaid = installment.allocations
          .filter(
            (allocation) =>
              allocation.component === 'INTEREST' ||
              allocation.component === 'PRINCIPAL',
          )
          .reduce(
            (sum, allocation) => sum.add(allocation.amount),
            new Prisma.Decimal(0),
          );
        const penaltyPaid = installment.allocations
          .filter((allocation) => allocation.component === 'PENALTY')
          .reduce(
            (sum, allocation) => sum.add(allocation.amount),
            new Prisma.Decimal(0),
          );
        return {
          contractual: total.contractual.add(
            Prisma.Decimal.max(
              installment.scheduledAmount.sub(contractualPaid),
              0,
            ),
          ),
          penalty: total.penalty.add(
            Prisma.Decimal.max(installment.penaltyDue.sub(penaltyPaid), 0),
          ),
        };
      },
      {
        contractual: new Prisma.Decimal(0),
        penalty: new Prisma.Decimal(0),
      },
    );

    return calculateFuturePlanBalances({
      contractualOutstanding,
      penaltyOutstanding,
      frozenContractual: frozen.contractual,
      frozenPenalty: frozen.penalty,
    });
  }

  private async appendEvent(
    tx: Tx,
    input: {
      obligationId: string;
      type: string;
      effectiveAt: Date;
      actor: Actor;
      correlationId: string;
      idempotencyKey: string;
      policyVersion?: string;
      causationId?: string;
      payload: Record<string, unknown>;
    },
  ) {
    const obligation = await tx.repaymentObligation.findUniqueOrThrow({
      where: { id: input.obligationId },
      select: { version: true },
    });
    const sequence = BigInt(obligation.version + 1);
    const payloadHash = stableHash(input.payload);

    const event = await tx.obligationEvent.create({
      data: {
        id: generateId.anyId('OE', 10),
        obligationId: input.obligationId,
        sequence,
        type: input.type,
        effectiveAt: input.effectiveAt,
        actorType: input.actor.type,
        actorId: input.actor.id,
        causationId: input.causationId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        policyVersion: input.policyVersion,
        payload: this.json(input.payload),
        payloadHash,
      },
    });

    await tx.repaymentObligation.update({
      where: { id: input.obligationId },
      data: { version: { increment: 1 } },
    });

    return event;
  }

  private async calculateBorrowerBalances(tx: Tx, borrowerId: string) {
    const loans = await tx.loan.findMany({
      where: { borrowerId, status: 'DISBURSED' },
      select: {
        id: true,
        repayable: true,
        repaid: true,
        penalty: true,
        penaltyRepaid: true,
        tenure: true,
        extension: true,
        disbursementDate: true,
      },
      orderBy: { disbursementDate: 'asc' },
    });

    const contractualOutstanding = loans.reduce(
      (total, loan) => total.add(loan.repayable.sub(loan.repaid)),
      new Prisma.Decimal(0),
    );
    const penaltyOutstanding = loans.reduce(
      (total, loan) => total.add(loan.penalty.sub(loan.penaltyRepaid)),
      new Prisma.Decimal(0),
    );

    return {
      loans,
      contractualOutstanding: money(
        Prisma.Decimal.max(contractualOutstanding, 0),
      ),
      penaltyOutstanding: money(Prisma.Decimal.max(penaltyOutstanding, 0)),
    };
  }

  private async settleFullyPaidLoans(tx: Tx, borrowerId: string) {
    const loans = await tx.loan.findMany({
      where: { borrowerId, status: 'DISBURSED' },
      select: {
        id: true,
        repayable: true,
        repaid: true,
        penalty: true,
        penaltyRepaid: true,
      },
    });
    for (const loan of loans) {
      if (
        loan.repaid.gte(loan.repayable) &&
        loan.penaltyRepaid.gte(loan.penalty)
      ) {
        await tx.loan.update({
          where: { id: loan.id },
          data: { status: 'REPAID' },
        });
      }
    }
  }

  private remainingLegacyTerm(
    loans: Array<{
      tenure: number;
      extension: number;
      disbursementDate: Date | null;
    }>,
    asOf: Date,
  ) {
    return loans.reduce((longest, loan) => {
      const elapsed = loan.disbursementDate
        ? Math.max(0, differenceInCalendarMonths(asOf, loan.disbursementDate))
        : 0;
      return Math.max(
        longest,
        Math.max(1, loan.tenure + loan.extension - elapsed),
      );
    }, 1);
  }

  private async publishPlan(tx: Tx, input: PlanPublicationInput) {
    const calculation = calculateRepaymentPlan({
      scheduledBalance: input.scheduledBalance,
      penaltyBalance: input.penaltyBalance,
      termMonths: input.termMonths,
      effectiveFrom: input.effectiveFrom,
    });
    const previousPlan = await tx.repaymentPlan.findFirst({
      where: {
        obligationId: input.obligationId,
        status: PlanStatus.PUBLISHED,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    const version = (previousPlan?.version ?? 0) + 1;
    const planId = generateId.anyId('PLN', 10);
    const snapshot = {
      ...input.snapshot,
      scheduledBalance: calculation.scheduledBalance.toFixed(2),
      penaltyBalance: calculation.penaltyBalance.toFixed(2),
      termMonths: calculation.termMonths,
      effectiveFromPeriod: calculation.effectiveFromPeriod.toISOString(),
      previousPlanId: previousPlan?.id ?? null,
    };

    if (previousPlan) {
      await tx.repaymentInstallment.updateMany({
        where: {
          planId: previousPlan.id,
          period: { gte: calculation.effectiveFromPeriod },
          status: {
            in: [InstallmentStatus.PLANNED, InstallmentStatus.PUBLISHED],
          },
        },
        data: { status: InstallmentStatus.SUPERSEDED },
      });
      await tx.repaymentPlan.update({
        where: { id: previousPlan.id },
        data: { status: PlanStatus.SUPERSEDED, supersededAt: new Date() },
      });
    }

    const plan = await tx.repaymentPlan.create({
      data: {
        id: planId,
        obligationId: input.obligationId,
        version,
        status: PlanStatus.PUBLISHED,
        reason: input.reason,
        policyName: input.policyName,
        policyVersion: input.policyVersion,
        inputEventSequence: input.triggerEventSequence,
        inputSnapshot: this.json(snapshot),
        inputHash: stableHash(snapshot),
        effectiveFromPeriod: calculation.effectiveFromPeriod,
        termMonths: calculation.termMonths,
        scheduledBalance: calculation.scheduledBalance,
        penaltyBalance: calculation.penaltyBalance,
        scheduledMonthly: calculation.scheduledMonthly,
        createdBy: input.actor.id,
        publishedAt: new Date(),
        installments: {
          create: calculation.installments.map((installment) => ({
            id: generateId.anyId('INS', 10),
            obligationId: input.obligationId,
            sequence: installment.sequence,
            period: installment.period,
            dueDate: installment.dueDate,
            scheduledAmount: installment.scheduledAmount,
            penaltyDue: installment.penaltyDue,
            totalExpected: installment.totalExpected,
            status: InstallmentStatus.PLANNED,
          })),
        },
      },
      include: { installments: { orderBy: { sequence: 'asc' } } },
    });

    await tx.repaymentObligation.update({
      where: { id: input.obligationId },
      data: {
        currentPlanId: plan.id,
      },
    });

    await this.appendEvent(tx, {
      obligationId: input.obligationId,
      type: 'REPAYMENT_PLAN_PUBLISHED',
      effectiveAt: calculation.effectiveFromPeriod,
      actor: input.actor,
      correlationId: `plan:${plan.id}`,
      causationId: `sequence:${input.triggerEventSequence.toString()}`,
      idempotencyKey: `plan-published:${plan.id}`,
      policyVersion: input.policyVersion,
      payload: {
        planId: plan.id,
        version: plan.version,
        reason: plan.reason,
        termMonths: plan.termMonths,
        scheduledMonthly: plan.scheduledMonthly.toFixed(2),
        scheduledBalance: plan.scheduledBalance.toFixed(2),
        penaltyBalance: plan.penaltyBalance.toFixed(2),
        effectiveFromPeriod: plan.effectiveFromPeriod.toISOString(),
        previousPlanId: previousPlan?.id ?? null,
        inputHash: plan.inputHash,
      },
    });

    return plan;
  }

  private async supersedeFuturePlanWithoutReplacement(
    tx: Tx,
    obligationId: string,
    currentPlanId: string | null,
    effectiveFrom: Date,
  ) {
    await tx.repaymentInstallment.updateMany({
      where: {
        obligationId,
        period: { gte: canonicalPeriod(effectiveFrom) },
        status: InstallmentStatus.PLANNED,
      },
      data: { status: InstallmentStatus.SUPERSEDED },
    });
    if (currentPlanId) {
      await tx.repaymentPlan.update({
        where: { id: currentPlanId },
        data: { status: PlanStatus.SUPERSEDED, supersededAt: new Date() },
      });
    }
    await tx.repaymentObligation.update({
      where: { id: obligationId },
      data: { currentPlanId: null },
    });
  }

  private async createBaselineObligation(
    tx: Tx,
    borrowerId: string,
    effectiveFrom: Date,
    actor: Actor,
  ) {
    const balances = await this.calculateBorrowerBalances(tx, borrowerId);
    if (balances.loans.length === 0) {
      throw new BadRequestException('Borrower has no disbursed advances');
    }

    const obligation = await tx.repaymentObligation.create({
      data: {
        id: generateId.anyId('OBL', 10),
        borrowerId,
        contractualOutstanding: balances.contractualOutstanding,
        penaltyOutstanding: balances.penaltyOutstanding,
      },
    });
    const correlationId = `baseline:${obligation.id}`;
    const event = await this.appendEvent(tx, {
      obligationId: obligation.id,
      type: 'MIGRATION_BASELINE_CREATED',
      effectiveAt: effectiveFrom,
      actor,
      correlationId,
      idempotencyKey: `migration-baseline:${borrowerId}`,
      policyVersion: 'MIGRATION_BASELINE_V1',
      payload: {
        borrowerId,
        loanIds: balances.loans.map((loan) => loan.id),
        contractualOutstanding: balances.contractualOutstanding.toFixed(2),
        penaltyOutstanding: balances.penaltyOutstanding.toFixed(2),
      },
    });

    await tx.obligationAdvance.createMany({
      data: balances.loans.map((loan) => ({
        id: generateId.anyId('OA', 10),
        obligationId: obligation.id,
        loanId: loan.id,
        joinedByEventId: event.id,
        joinedAt: loan.disbursementDate ?? effectiveFrom,
      })),
      skipDuplicates: true,
    });

    const termMonths = this.remainingLegacyTerm(balances.loans, effectiveFrom);
    const plan = await this.publishPlan(tx, {
      obligationId: obligation.id,
      scheduledBalance: balances.contractualOutstanding,
      penaltyBalance: balances.penaltyOutstanding,
      termMonths,
      effectiveFrom: canonicalPeriod(effectiveFrom),
      reason: PlanReason.MIGRATION_BASELINE,
      policyName: 'MIGRATION_BASELINE',
      policyVersion: 'MIGRATION_BASELINE_V1',
      actor,
      triggerEventSequence: event.sequence,
      snapshot: {
        source: 'legacy-active-loans',
        loanIds: balances.loans.map((loan) => loan.id),
      },
    });

    return { obligation, plan };
  }

  async backfillActiveObligations(asOf = new Date()) {
    const borrowers = await this.prisma.loan.findMany({
      where: { status: 'DISBURSED' },
      distinct: ['borrowerId'],
      select: { borrowerId: true },
    });
    let created = 0;

    for (const { borrowerId } of borrowers) {
      const existing = await this.prisma.repaymentObligation.findFirst({
        where: {
          borrowerId,
          status: { in: ['DRAFT', 'ACTIVE', 'SUSPENDED'] },
        },
        select: { id: true },
      });
      if (existing) continue;

      try {
        await this.prisma.$transaction(
          (tx) =>
            this.createBaselineObligation(
              tx,
              borrowerId,
              canonicalPeriod(asOf),
              {
                id: 'SYSTEM_MIGRATION',
                type: EventActorType.SYSTEM,
              },
            ),
          FINANCIAL_TRANSACTION_OPTIONS,
        );
        created++;
      } catch (error) {
        // Multiple queue workers can start the one-time lazy backfill together.
        // The borrower unique key makes all losing workers safely converge on
        // the baseline committed by the winner.
        if (
          !(
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          )
        ) {
          throw error;
        }
      }
    }

    return { created, inspected: borrowers.length };
  }

  async disburseAdvance(loanId: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const loan = await tx.loan.findUnique({
          where: { id: loanId },
          select: {
            id: true,
            borrowerId: true,
            principal: true,
            managementFeeRate: true,
            interestRate: true,
            tenure: true,
            type: true,
            status: true,
          },
        });
        if (!loan) throw new NotFoundException('Loan not found');
        if (loan.status !== 'APPROVED') {
          throw new ConflictException('Only an approved loan can be disbursed');
        }

        const disbursementDate = new Date();
        const totalPayment = money(
          logic.getTotalPayment(
            loan.principal.toNumber(),
            loan.interestRate.toNumber(),
            loan.tenure,
          ),
        );
        const feeAmount = money(loan.principal.mul(loan.managementFeeRate));
        const netDisbursed = money(loan.principal.sub(feeAmount));
        const effectivePeriod = await this.nextUnpublishedPeriodInTx(
          tx,
          disbursementDate,
        );
        let obligation = await tx.repaymentObligation.findFirst({
          where: {
            borrowerId: loan.borrowerId,
            status: { in: ['DRAFT', 'ACTIVE', 'SUSPENDED'] },
          },
          include: {
            currentPlan: {
              include: {
                installments: {
                  where: {
                    period: { gte: effectivePeriod },
                    status: {
                      in: [
                        InstallmentStatus.PLANNED,
                        InstallmentStatus.PUBLISHED,
                      ],
                    },
                  },
                },
              },
            },
            advances: { select: { loanId: true } },
          },
        });

        if (!obligation) {
          const existingBalances = await this.calculateBorrowerBalances(
            tx,
            loan.borrowerId,
          );
          if (existingBalances.loans.length > 0) {
            const baseline = await this.createBaselineObligation(
              tx,
              loan.borrowerId,
              canonicalPeriod(disbursementDate),
              { id: actorId, type: EventActorType.ADMIN },
            );
            obligation = await tx.repaymentObligation.findUniqueOrThrow({
              where: { id: baseline.obligation.id },
              include: {
                currentPlan: { include: { installments: true } },
                advances: { select: { loanId: true } },
              },
            });
          } else {
            obligation = await tx.repaymentObligation.create({
              data: {
                id: generateId.anyId('OBL', 10),
                borrowerId: loan.borrowerId,
              },
              include: {
                currentPlan: { include: { installments: true } },
                advances: { select: { loanId: true } },
              },
            });
          }
        }

        const isTopup = obligation.advances.length > 0 || loan.type === 'Topup';
        const oldContractualOutstanding = money(
          obligation.contractualOutstanding,
        );
        const oldPenaltyOutstanding = money(obligation.penaltyOutstanding);
        const oldRemainingTerm = obligation.currentPlan
          ? Math.max(1, obligation.currentPlan.installments.length)
          : 1;

        await tx.loan.update({
          where: { id: loan.id },
          data: {
            status: 'DISBURSED',
            disbursementDate,
            repayable: totalPayment,
          },
        });

        const correlationId = `disbursement:${loan.id}`;
        const event = await this.appendEvent(tx, {
          obligationId: obligation.id,
          type: isTopup ? 'TOPUP_DISBURSED' : 'ADVANCE_DISBURSED',
          effectiveAt: disbursementDate,
          actor: { id: actorId, type: EventActorType.ADMIN },
          correlationId,
          idempotencyKey: `advance-disbursed:${loan.id}`,
          policyVersion: isTopup ? 'TOPUP_CONSOLIDATION_V1' : 'INITIAL_PLAN_V1',
          payload: {
            loanId: loan.id,
            principal: loan.principal.toFixed(2),
            managementFee: feeAmount.toFixed(2),
            netDisbursed: netDisbursed.toFixed(2),
            contractualRepayable: totalPayment.toFixed(2),
            selectedTerm: loan.tenure,
            oldContractualOutstanding: oldContractualOutstanding.toFixed(2),
            oldPenaltyOutstanding: oldPenaltyOutstanding.toFixed(2),
            oldRemainingTerm,
          },
        });

        await tx.obligationAdvance.create({
          data: {
            id: generateId.anyId('OA', 10),
            obligationId: obligation.id,
            loanId: loan.id,
            joinedByEventId: event.id,
            joinedAt: disbursementDate,
          },
        });

        const termMonths = isTopup
          ? Math.max(oldRemainingTerm, loan.tenure)
          : loan.tenure;
        const consolidatedBalance = money(
          oldContractualOutstanding.add(totalPayment),
        );
        const futureBalances = await this.balancesAvailableForFuturePlan(
          tx,
          obligation.id,
          effectivePeriod,
          oldContractualOutstanding,
          oldPenaltyOutstanding,
        );
        const futureConsolidatedBalance = money(
          futureBalances.contractual.add(totalPayment),
        );
        await tx.repaymentObligation.update({
          where: { id: obligation.id },
          data: {
            contractualOutstanding: consolidatedBalance,
            penaltyOutstanding: oldPenaltyOutstanding,
            status: 'ACTIVE',
            settledAt: null,
          },
        });
        const plan = await this.publishPlan(tx, {
          obligationId: obligation.id,
          scheduledBalance: futureConsolidatedBalance,
          penaltyBalance: futureBalances.penalty,
          termMonths,
          effectiveFrom: effectivePeriod,
          reason: isTopup ? PlanReason.TOPUP : PlanReason.INITIAL_DISBURSEMENT,
          policyName: isTopup ? 'TOPUP_CONSOLIDATION' : 'INITIAL_PLAN',
          policyVersion: isTopup ? 'TOPUP_CONSOLIDATION_V1' : 'INITIAL_PLAN_V1',
          actor: { id: actorId, type: EventActorType.ADMIN },
          triggerEventSequence: event.sequence,
          snapshot: {
            loanId: loan.id,
            oldContractualOutstanding: oldContractualOutstanding.toFixed(2),
            newAdvanceContractualRepayable: totalPayment.toFixed(2),
            actualConsolidatedBalance: consolidatedBalance.toFixed(2),
            futureScheduledBalance: futureConsolidatedBalance.toFixed(2),
            frozenPublishedContractual:
              futureBalances.frozenContractual.toFixed(2),
            frozenPublishedPenalty: futureBalances.frozenPenalty.toFixed(2),
            oldRemainingTerm,
            selectedTopupTerm: loan.tenure,
            consolidatedTerm: termMonths,
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: generateId.anyId('OUT', 10),
            topic: isTopup ? 'topup.disbursed' : 'advance.disbursed',
            aggregateId: obligation.id,
            payload: this.json({
              obligationId: obligation.id,
              loanId: loan.id,
              planId: plan.id,
              planVersion: plan.version,
            }),
          },
        });

        return {
          borrowerId: loan.borrowerId,
          obligationId: obligation.id,
          loanId: loan.id,
          isTopup,
          feeAmount,
          principal: loan.principal,
          netDisbursed,
          contractualRepayable: totalPayment,
          consolidatedBalance,
          penaltyOutstanding: oldPenaltyOutstanding,
          termMonths,
          monthly: plan.scheduledMonthly,
          startDate: plan.effectiveFromPeriod,
          endDate: plan.installments[plan.installments.length - 1].dueDate,
          planId: plan.id,
          planVersion: plan.version,
        };
      },
      FINANCIAL_TRANSACTION_OPTIONS,
    );
  }

  async getByBorrower(borrowerId: string) {
    const obligation = await this.prisma.repaymentObligation.findFirst({
      where: {
        borrowerId,
        status: { in: ['DRAFT', 'ACTIVE', 'SUSPENDED'] },
      },
      include: {
        currentPlan: {
          include: {
            installments: { orderBy: { sequence: 'asc' } },
          },
        },
        advances: {
          include: {
            loan: {
              select: {
                id: true,
                type: true,
                principal: true,
                repayable: true,
                repaid: true,
                penalty: true,
                penaltyRepaid: true,
                tenure: true,
                disbursementDate: true,
                status: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!obligation) return null;

    return {
      ...obligation,
      contractualOutstanding: obligation.contractualOutstanding.toNumber(),
      penaltyOutstanding: obligation.penaltyOutstanding.toNumber(),
      creditBalance: obligation.creditBalance.toNumber(),
      currentPlan: obligation.currentPlan
          ? {
              ...obligation.currentPlan,
              inputEventSequence:
                obligation.currentPlan.inputEventSequence.toString(),
              scheduledBalance:
                obligation.currentPlan.scheduledBalance.toNumber(),
            penaltyBalance: obligation.currentPlan.penaltyBalance.toNumber(),
            scheduledMonthly:
              obligation.currentPlan.scheduledMonthly.toNumber(),
            installments: obligation.currentPlan.installments.map((item) => ({
              ...item,
              scheduledAmount: item.scheduledAmount.toNumber(),
              penaltyDue: item.penaltyDue.toNumber(),
              totalExpected: item.totalExpected.toNumber(),
              paidAmount: item.paidAmount.toNumber(),
              waivedAmount: item.waivedAmount.toNumber(),
            })),
          }
        : null,
      advances: obligation.advances.map((advance) => ({
        ...advance,
        loan: {
          ...advance.loan,
          principal: advance.loan.principal.toNumber(),
          repayable: advance.loan.repayable.toNumber(),
          repaid: advance.loan.repaid.toNumber(),
          penalty: advance.loan.penalty.toNumber(),
          penaltyRepaid: advance.loan.penaltyRepaid.toNumber(),
        },
      })),
    };
  }

  async previewTenureChange(obligationId: string, dto: TenureChangePreviewDto) {
    const obligation = await this.prisma.repaymentObligation.findUnique({
      where: { id: obligationId },
      include: { currentPlan: true },
    });
    if (!obligation || !obligation.currentPlan) {
      throw new NotFoundException('Active repayment obligation not found');
    }
    if (obligation.status !== 'ACTIVE') {
      throw new ConflictException('Only active obligations can change tenure');
    }

    const effectiveFrom = await this.nextUnpublishedPeriod(new Date());
    const futureBalances = await this.balancesAvailableForFuturePlan(
      this.prisma,
      obligationId,
      effectiveFrom,
      obligation.contractualOutstanding,
      obligation.penaltyOutstanding,
    );
    if (futureBalances.contractual.eq(0) && futureBalances.penalty.eq(0)) {
      throw new BadRequestException(
        'No unpaid future balance is available for a tenure change',
      );
    }
    const calculation = calculateRepaymentPlan({
      scheduledBalance: futureBalances.contractual,
      penaltyBalance: futureBalances.penalty,
      termMonths: dto.termMonths,
      effectiveFrom,
    });
    const preview = {
      obligationId,
      obligationVersion: obligation.version,
      previousPlanId: obligation.currentPlan.id,
      previousTermMonths: obligation.currentPlan.termMonths,
      previousMonthly: obligation.currentPlan.scheduledMonthly.toFixed(2),
      contractualOutstanding: futureBalances.contractual.toFixed(2),
      penaltyOutstanding: futureBalances.penalty.toFixed(2),
      actualContractualOutstanding:
        obligation.contractualOutstanding.toFixed(2),
      actualPenaltyOutstanding: obligation.penaltyOutstanding.toFixed(2),
      frozenPublishedContractual: futureBalances.frozenContractual.toFixed(2),
      frozenPublishedPenalty: futureBalances.frozenPenalty.toFixed(2),
      proposedTermMonths: calculation.termMonths,
      proposedMonthly: calculation.scheduledMonthly.toFixed(2),
      effectiveFromPeriod: calculation.effectiveFromPeriod.toISOString(),
      endDate: calculation.endDate.toISOString(),
      policyVersion: 'MANUAL_TENURE_CHANGE_V1',
    };

    return { ...preview, previewHash: stableHash(preview) };
  }

  async requestTenureChange(
    obligationId: string,
    dto: CreateTenureChangeRequestDto,
    requestedBy: string,
  ) {
    const preview = await this.previewTenureChange(obligationId, dto);
    if (preview.obligationVersion !== dto.expectedObligationVersion) {
      throw new ConflictException(
        'Obligation changed after it was viewed; request a new preview',
      );
    }
    const pending = await this.prisma.tenureChangeRequest.findFirst({
      where: { obligationId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException('A tenure change is already pending');
    }

    return this.prisma.tenureChangeRequest.create({
      data: {
        id: generateId.anyId('TCR', 10),
        obligationId,
        requestedTermMonths: dto.termMonths,
        previousTermMonths: preview.previousTermMonths,
        previousMonthly: preview.previousMonthly,
        proposedMonthly: preview.proposedMonthly,
        balanceSnapshot: preview.contractualOutstanding,
        effectiveFromPeriod: new Date(preview.effectiveFromPeriod),
        reasonCode: dto.reasonCode,
        note: dto.note,
        requestedBy,
        expectedObligationVersion: dto.expectedObligationVersion,
        previewHash: preview.previewHash,
      },
    });
  }

  async approveTenureChange(requestId: string, approvedBy: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.tenureChangeRequest.findUnique({
          where: { id: requestId },
          include: { obligation: true },
        });
        if (!request) throw new NotFoundException('Tenure request not found');
        if (request.status !== 'PENDING') {
          throw new ConflictException(
            'Tenure request has already been decided',
          );
        }
        if (request.obligation.version !== request.expectedObligationVersion) {
          throw new ConflictException(
            'Obligation changed after the request; create a new tenure preview',
          );
        }
        const nextEligiblePeriod = await this.nextUnpublishedPeriodInTx(
          tx,
          new Date(),
        );
        if (
          nextEligiblePeriod.getTime() !== request.effectiveFromPeriod.getTime()
        ) {
          throw new ConflictException(
            'A payroll schedule was published after this preview; create a new tenure request',
          );
        }

        const event = await this.appendEvent(tx, {
          obligationId: request.obligationId,
          type: 'TENURE_CHANGE_APPROVED',
          effectiveAt: request.effectiveFromPeriod,
          actor: { id: approvedBy, type: EventActorType.ADMIN },
          correlationId: `tenure-change:${request.id}`,
          idempotencyKey: `tenure-change-approved:${request.id}`,
          policyVersion: 'MANUAL_TENURE_CHANGE_V1',
          payload: {
            requestId: request.id,
            previousTermMonths: request.previousTermMonths,
            requestedTermMonths: request.requestedTermMonths,
            previousMonthly: request.previousMonthly.toFixed(2),
            proposedMonthly: request.proposedMonthly.toFixed(2),
            balanceSnapshot: request.balanceSnapshot.toFixed(2),
            reasonCode: request.reasonCode,
            note: request.note,
          },
        });

        const futureBalances = await this.balancesAvailableForFuturePlan(
          tx,
          request.obligationId,
          request.effectiveFromPeriod,
          request.obligation.contractualOutstanding,
          request.obligation.penaltyOutstanding,
        );
        if (!futureBalances.contractual.eq(request.balanceSnapshot)) {
          throw new ConflictException(
            'Future schedulable balance changed after preview; create a new tenure request',
          );
        }
        const plan = await this.publishPlan(tx, {
          obligationId: request.obligationId,
          scheduledBalance: futureBalances.contractual,
          penaltyBalance: futureBalances.penalty,
          termMonths: request.requestedTermMonths,
          effectiveFrom: request.effectiveFromPeriod,
          reason: PlanReason.MANUAL_TENURE_CHANGE,
          policyName: 'MANUAL_TENURE_CHANGE',
          policyVersion: 'MANUAL_TENURE_CHANGE_V1',
          actor: { id: approvedBy, type: EventActorType.ADMIN },
          triggerEventSequence: event.sequence,
          snapshot: {
            requestId: request.id,
            previousTermMonths: request.previousTermMonths,
            requestedTermMonths: request.requestedTermMonths,
            reasonCode: request.reasonCode,
          },
        });

        await tx.tenureChangeRequest.update({
          where: { id: request.id },
          data: {
            status: 'APPROVED',
            approvedBy,
            decidedAt: new Date(),
          },
        });

        return {
          id: plan.id,
          obligationId: plan.obligationId,
          version: plan.version,
          status: plan.status,
          reason: plan.reason,
          termMonths: plan.termMonths,
          scheduledBalance: plan.scheduledBalance.toNumber(),
          penaltyBalance: plan.penaltyBalance.toNumber(),
          scheduledMonthly: plan.scheduledMonthly.toNumber(),
          effectiveFromPeriod: plan.effectiveFromPeriod,
          publishedAt: plan.publishedAt,
        };
      },
      FINANCIAL_TRANSACTION_OPTIONS,
    );
  }

  async rejectTenureChange(
    requestId: string,
    rejectedBy: string,
    reason: string,
  ) {
    const request = await this.prisma.tenureChangeRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, note: true },
    });
    if (!request) throw new NotFoundException('Tenure request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Tenure request has already been decided');
    }
    return this.prisma.tenureChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        decidedAt: new Date(),
        note: request.note ? `${request.note}\nRejection: ${reason}` : reason,
      },
    });
  }

  async prepareVariationSchedule(
    period: string,
    generatedBy: string,
    publish: boolean,
  ) {
    const periodDate = canonicalPeriod(parsePeriodToDate(period));
    const existing = await this.prisma.payrollSchedule.findFirst({
      where: {
        period: periodDate,
        ...(publish ? { status: 'PUBLISHED' } : {}),
      },
      include: { rows: { orderBy: { externalId: 'asc' } } },
      orderBy: { version: 'desc' },
    });
    if (existing) return this.mapSchedule(existing);

    return this.prisma.$transaction(async (tx) => {
      const installments = await tx.repaymentInstallment.findMany({
        where: {
          period: periodDate,
          OR: [
            {
              status: InstallmentStatus.PLANNED,
              plan: { status: PlanStatus.PUBLISHED },
            },
            {
              status: {
                in: [InstallmentStatus.PUBLISHED, InstallmentStatus.PARTIAL],
              },
            },
          ],
          obligation: { status: 'ACTIVE' },
        },
        include: {
          plan: {
            include: {
              installments: {
                where: {
                  period: { gte: periodDate },
                  status: {
                    in: [
                      InstallmentStatus.PLANNED,
                      InstallmentStatus.PUBLISHED,
                      InstallmentStatus.PARTIAL,
                    ],
                  },
                },
                orderBy: { sequence: 'asc' },
              },
            },
          },
          obligation: {
            include: {
              borrower: {
                select: {
                  id: true,
                  externalId: true,
                  name: true,
                  payroll: { select: { command: true } },
                },
              },
            },
          },
        },
        orderBy: { obligation: { borrowerId: 'asc' } },
      });
      const eligible = installments.filter(
        (item) =>
          item.obligation.borrower.externalId &&
          item.obligation.borrower.payroll,
      );
      if (eligible.length === 0) {
        throw new BadRequestException(
          `No published repayment installments are due for ${period}`,
        );
      }

      const latest = await tx.payrollSchedule.findFirst({
        where: { period: periodDate },
        orderBy: { version: 'desc' },
        select: { version: true, id: true },
      });
      const scheduleId = generateId.anyId('SCH', 10);
      const schedule = await tx.payrollSchedule.create({
        data: {
          id: scheduleId,
          period: periodDate,
          version: (latest?.version ?? 0) + 1,
          status: publish ? 'PUBLISHED' : 'DRAFT',
          generatedBy,
          publishedAt: publish ? new Date() : null,
          supersedesScheduleId: publish ? latest?.id : null,
          rowCount: eligible.length,
          totalAmount: eligible.reduce(
            (total, item) => total.add(item.totalExpected),
            new Prisma.Decimal(0),
          ),
          rows: {
            create: eligible.map((item) => {
              const contractual = item.obligation.contractualOutstanding;
              const penalty = item.obligation.penaltyOutstanding;
              const endDate =
                item.plan.installments[item.plan.installments.length - 1]
                  ?.dueDate ?? item.dueDate;
              const row = {
                installmentId: item.id,
                obligationId: item.obligationId,
                borrowerId: item.obligation.borrower.id,
                externalId: item.obligation.borrower.externalId!,
                borrowerName: item.obligation.borrower.name,
                command: item.obligation.borrower.payroll!.command,
                amount: item.totalExpected.toFixed(2),
                contractualOutstanding: contractual.toFixed(2),
                penaltyOutstanding: penalty.toFixed(2),
                termRemaining: item.plan.installments.length,
                startDate: item.plan.effectiveFromPeriod.toISOString(),
                endDate: endDate.toISOString(),
              };
              return {
                id: generateId.anyId('SR', 10),
                installmentId: item.id,
                obligationId: item.obligationId,
                borrowerId: item.obligation.borrower.id,
                externalId: item.obligation.borrower.externalId!,
                borrowerName: item.obligation.borrower.name,
                command: item.obligation.borrower.payroll!.command,
                amount: item.totalExpected,
                contractualOutstanding: contractual,
                penaltyOutstanding: penalty,
                totalOutstanding: contractual.add(penalty),
                termRemaining: item.plan.installments.length,
                startDate: item.plan.effectiveFromPeriod,
                endDate,
                rowHash: stableHash(row),
              };
            }),
          },
        },
        include: { rows: { orderBy: { externalId: 'asc' } } },
      });

      if (publish) {
        await tx.repaymentInstallment.updateMany({
          where: { id: { in: eligible.map((item) => item.id) } },
          data: { status: InstallmentStatus.PUBLISHED },
        });
      }

      return this.mapSchedule(schedule);
    });
  }

  private mapSchedule(schedule: {
    id: string;
    version: number;
    status: string;
    rows: Array<{
      id: string;
      installmentId: string;
      obligationId: string;
      externalId: string;
      borrowerName: string;
      command: string;
      contractualOutstanding: Prisma.Decimal;
      penaltyOutstanding: Prisma.Decimal;
      totalOutstanding: Prisma.Decimal;
      amount: Prisma.Decimal;
      termRemaining: number;
      startDate: Date;
      endDate: Date;
    }>;
  }) {
    return {
      scheduleId: schedule.id,
      version: schedule.version,
      status: schedule.status,
      rows: schedule.rows.map<VariationScheduleRow>((row) => ({
        scheduleRowId: row.id,
        installmentId: row.installmentId,
        obligationId: row.obligationId,
        externalId: row.externalId,
        name: row.borrowerName,
        command: row.command,
        contractualOutstanding: row.contractualOutstanding.toNumber(),
        penaltyOutstanding: row.penaltyOutstanding.toNumber(),
        totalOutstanding: row.totalOutstanding.toNumber(),
        expected: row.amount.toNumber(),
        tenure: row.termRemaining,
        start: row.startDate,
        end: row.endDate,
      })),
    };
  }

  async setScheduleArtifact(scheduleId: string, hash: string, url?: string) {
    const existing = await this.prisma.payrollSchedule.findUnique({
      where: { id: scheduleId },
      select: { artifactHash: true },
    });
    if (!existing) throw new NotFoundException('Payroll schedule not found');
    if (existing.artifactHash && existing.artifactHash !== hash) {
      throw new ConflictException(
        'Published schedule artifact hash does not match its original file',
      );
    }
    return this.prisma.payrollSchedule.update({
      where: { id: scheduleId },
      data: { artifactHash: hash, artifactUrl: url },
    });
  }

  async getTenureHistory(obligationId: string) {
    return this.prisma.repaymentPlan.findMany({
      where: { obligationId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        reason: true,
        policyName: true,
        policyVersion: true,
        effectiveFromPeriod: true,
        termMonths: true,
        scheduledBalance: true,
        penaltyBalance: true,
        scheduledMonthly: true,
        createdBy: true,
        createdAt: true,
        publishedAt: true,
        supersededAt: true,
        inputHash: true,
      },
    });
  }

  async getAuditTrail(obligationId: string) {
    const exists = await this.prisma.repaymentObligation.findUnique({
      where: { id: obligationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Repayment obligation not found');

    const events = await this.prisma.obligationEvent.findMany({
      where: { obligationId },
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        sequence: true,
        type: true,
        effectiveAt: true,
        recordedAt: true,
        actorType: true,
        actorId: true,
        causationId: true,
        correlationId: true,
        idempotencyKey: true,
        policyVersion: true,
        payload: true,
        payloadHash: true,
      },
    });
    return events.map((event) => ({
      ...event,
      sequence: event.sequence.toString(),
    }));
  }

  async adjustPenalty(
    obligationId: string,
    dto: PenaltyAdjustmentDto,
    actorId: string,
  ) {
    const amount = money(new Prisma.Decimal(dto.amountKobo).div(100));

    return this.prisma.$transaction(
      async (tx) => {
        const obligation = await tx.repaymentObligation.findUnique({
          where: { id: obligationId },
          include: {
            currentPlan: {
              include: {
                installments: {
                  where: {
                    status: {
                      in: [
                        InstallmentStatus.PLANNED,
                        InstallmentStatus.PUBLISHED,
                        InstallmentStatus.PARTIAL,
                      ],
                    },
                    period: { gte: canonicalPeriod(new Date()) },
                  },
                },
              },
            },
          },
        });
        if (!obligation) {
          throw new NotFoundException('Repayment obligation not found');
        }
        if (obligation.version !== dto.expectedObligationVersion) {
          throw new ConflictException(
            'Obligation changed after it was viewed; reload before adjusting penalty',
          );
        }
        if (amount.gt(obligation.penaltyOutstanding)) {
          throw new BadRequestException(
            'Penalty adjustment cannot exceed the outstanding penalty',
          );
        }
        const effectiveFrom = await this.nextUnpublishedPeriodInTx(
          tx,
          new Date(),
        );
        const beforeAdjustment = await this.balancesAvailableForFuturePlan(
          tx,
          obligationId,
          effectiveFrom,
          obligation.contractualOutstanding,
          obligation.penaltyOutstanding,
        );
        if (beforeAdjustment.frozenPenalty.gt(0)) {
          throw new ConflictException(
            'Penalty is already in a published payroll row; use the formal payroll amendment process first',
          );
        }
        const event = await this.appendEvent(tx, {
          obligationId,
          type: `PENALTY_${dto.type}`,
          effectiveAt: effectiveFrom,
          actor: { id: actorId, type: EventActorType.ADMIN },
          correlationId: `penalty-adjustment:${obligationId}:${obligation.version + 1}`,
          idempotencyKey: `penalty-adjustment:${obligationId}:${obligation.version + 1}`,
          policyVersion: 'PENALTY_ADJUSTMENT_V1',
          payload: {
            adjustmentType: dto.type,
            amount: amount.toFixed(2),
            previousPenaltyOutstanding:
              obligation.penaltyOutstanding.toFixed(2),
            newPenaltyOutstanding: obligation.penaltyOutstanding
              .sub(amount)
              .toFixed(2),
            reasonCode: dto.reasonCode,
            note: dto.note,
          },
        });

        await tx.penaltyEntry.create({
          data: {
            id: generateId.anyId('PEN', 10),
            obligationId,
            eventId: event.id,
            entryType: dto.type,
            amount,
            effectiveAt: effectiveFrom,
            reasonCode: dto.reasonCode,
            note: dto.note,
            actorId,
          },
        });

        // Keep legacy Loan.penalty - penaltyRepaid views reconciled during the
        // transition. PenaltyEntry remains the authoritative explanation.
        let legacyRemaining = amount;
        const loans = await tx.loan.findMany({
          where: { borrowerId: obligation.borrowerId },
          orderBy: { disbursementDate: 'asc' },
        });
        for (const loan of loans) {
          if (legacyRemaining.lte(0)) break;
          const loanPenaltyDue = money(
            Prisma.Decimal.max(loan.penalty.sub(loan.penaltyRepaid), 0),
          );
          const adjusted = money(
            Prisma.Decimal.min(legacyRemaining, loanPenaltyDue),
          );
          if (adjusted.lte(0)) continue;
          await tx.loan.update({
            where: { id: loan.id },
            data: { penaltyRepaid: { increment: adjusted } },
          });
          legacyRemaining = legacyRemaining.sub(adjusted);
        }

        const newPenalty = money(obligation.penaltyOutstanding.sub(amount));
        await tx.repaymentObligation.update({
          where: { id: obligationId },
          data: {
            penaltyOutstanding: newPenalty,
            ...(obligation.contractualOutstanding.eq(0) && newPenalty.eq(0)
              ? { status: 'SETTLED', settledAt: new Date() }
              : {}),
          },
        });
        const futureBalances = await this.balancesAvailableForFuturePlan(
          tx,
          obligationId,
          effectiveFrom,
          obligation.contractualOutstanding,
          newPenalty,
        );
        const remainingTerm = Math.max(
          1,
          obligation.currentPlan?.installments.filter(
            (item) => item.period >= effectiveFrom,
          ).length ?? 1,
        );
        const plan =
          futureBalances.contractual.gt(0) || futureBalances.penalty.gt(0)
            ? await this.publishPlan(tx, {
                obligationId,
                scheduledBalance: futureBalances.contractual,
                penaltyBalance: futureBalances.penalty,
                termMonths: remainingTerm,
                effectiveFrom,
                reason: PlanReason.MANUAL_RESTRUCTURE,
                policyName: 'PENALTY_ADJUSTMENT',
                policyVersion: 'PENALTY_ADJUSTMENT_V1',
                actor: { id: actorId, type: EventActorType.ADMIN },
                triggerEventSequence: event.sequence,
                snapshot: {
                  adjustmentType: dto.type,
                  adjustmentAmount: amount.toFixed(2),
                  reasonCode: dto.reasonCode,
                  remainingTerm,
                },
              })
            : null;

        if (!plan) {
          await this.supersedeFuturePlanWithoutReplacement(
            tx,
            obligationId,
            obligation.currentPlanId,
            effectiveFrom,
          );
        }

        return {
          eventId: event.id,
          planId: plan?.id ?? null,
          planVersion: plan?.version ?? null,
          penaltyOutstanding: newPenalty.toNumber(),
          effectiveFromPeriod: effectiveFrom,
        };
      },
      FINANCIAL_TRANSACTION_OPTIONS,
    );
  }

  async createCompatibilityExpectations(period: string) {
    const periodDate = canonicalPeriod(parsePeriodToDate(period));
    const installments = await this.prisma.repaymentInstallment.findMany({
      where: {
        period: periodDate,
        OR: [
          {
            status: InstallmentStatus.PLANNED,
            plan: { status: PlanStatus.PUBLISHED },
          },
          {
            status: {
              in: [InstallmentStatus.PUBLISHED, InstallmentStatus.PARTIAL],
            },
          },
        ],
        obligation: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        obligationId: true,
        totalExpected: true,
        penaltyDue: true,
        obligation: { select: { borrowerId: true } },
      },
    });
    if (installments.length === 0) return 0;

    const existing = await this.prisma.repayment.findMany({
      where: { installmentId: { in: installments.map((item) => item.id) } },
      select: { installmentId: true },
    });
    const existingIds = new Set(existing.map((item) => item.installmentId));
    const missing = installments.filter((item) => !existingIds.has(item.id));
    if (missing.length === 0) return 0;

    const created = await this.prisma.repayment.createMany({
      data: missing.map((item) => ({
        id: generateId.repaymentId(),
        amount: 0,
        expectedAmount: item.totalExpected,
        penaltyCharge: item.penaltyDue,
        period: period.toUpperCase(),
        periodInDT: periodDate,
        userId: item.obligation.borrowerId,
        obligationId: item.obligationId,
        installmentId: item.id,
        status: 'AWAITING',
        source: 'PAYROLL',
      })),
      skipDuplicates: true,
    });
    return created.count;
  }

  async applyPayrollPayment(input: {
    userId: string;
    period: string;
    amount: Prisma.Decimal.Value;
    externalReference: string;
    rawPayload?: Record<string, unknown>;
  }) {
    const periodDate = canonicalPeriod(parsePeriodToDate(input.period));
    const receiptAmount = money(input.amount);
    if (receiptAmount.lte(0)) {
      throw new BadRequestException('Receipt amount must be positive');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const obligation = await tx.repaymentObligation.findFirst({
          where: {
            borrowerId: input.userId,
            OR: [
              { status: { in: ['DRAFT', 'ACTIVE', 'SUSPENDED'] } },
              {
                installments: {
                  some: {
                    period: periodDate,
                    closedAt: null,
                    status: {
                      in: [
                        InstallmentStatus.PUBLISHED,
                        InstallmentStatus.PARTIAL,
                      ],
                    },
                  },
                },
              },
            ],
          },
          orderBy: { openedAt: 'desc' },
        });
        if (!obligation) {
          throw new NotFoundException('Repayment obligation not found');
        }
        const idempotencyKey = `payroll:${periodDate.toISOString()}:${input.externalReference}`;
        const duplicate = await tx.paymentReceipt.findUnique({
          where: { idempotencyKey },
          include: { allocations: true },
        });
        if (duplicate) {
          const applied = duplicate.allocations
            .filter((item) => item.component !== 'CREDIT')
            .reduce(
              (total, item) => total.add(item.amount),
              new Prisma.Decimal(0),
            );
          const credit = duplicate.allocations
            .filter((item) => item.component === 'CREDIT')
            .reduce(
              (total, item) => total.add(item.amount),
              new Prisma.Decimal(0),
            );
          return {
            duplicate: true,
            receiptId: duplicate.id,
            applied: applied.toNumber(),
            credit: credit.toNumber(),
            penaltyPaid: duplicate.allocations
              .filter((item) => item.component === 'PENALTY')
              .reduce(
                (total, item) => total.add(item.amount),
                new Prisma.Decimal(0),
              )
              .toNumber(),
            interestPaid: duplicate.allocations
              .filter((item) => item.component === 'INTEREST')
              .reduce(
                (total, item) => total.add(item.amount),
                new Prisma.Decimal(0),
              )
              .toNumber(),
          };
        }

        const installment = await tx.repaymentInstallment.findFirst({
          where: {
            obligationId: obligation.id,
            period: periodDate,
            closedAt: null,
            OR: [
              {
                status: InstallmentStatus.PLANNED,
                plan: { status: PlanStatus.PUBLISHED },
              },
              {
                status: {
                  in: [InstallmentStatus.PUBLISHED, InstallmentStatus.PARTIAL],
                },
              },
            ],
          },
        });
        if (!installment) {
          throw new NotFoundException(
            `No published installment exists for ${input.period}`,
          );
        }
        const scheduleRow = await tx.payrollScheduleRow.findFirst({
          where: { installmentId: installment.id },
          orderBy: { schedule: { version: 'desc' } },
          select: { id: true },
        });
        const receipt = await tx.paymentReceipt.create({
          data: {
            id: generateId.anyId('RCT', 10),
            obligationId: obligation.id,
            scheduleRowId: scheduleRow?.id,
            source: 'PAYROLL',
            period: periodDate,
            amount: receiptAmount,
            externalReference: input.externalReference,
            idempotencyKey,
            status: 'MATCHED',
            receivedAt: new Date(),
            rawPayload: input.rawPayload
              ? this.json(input.rawPayload)
              : undefined,
          },
        });

        const remainingDue = money(
          Prisma.Decimal.max(
            installment.totalExpected
              .sub(installment.paidAmount)
              .sub(installment.waivedAmount),
            0,
          ),
        );
        const receivedAgainstInstallment = money(
          Prisma.Decimal.min(receiptAmount, remainingDue),
        );
        const actualOutstanding = money(
          obligation.contractualOutstanding.add(obligation.penaltyOutstanding),
        );
        const appliedToDebt = money(
          Prisma.Decimal.min(receivedAgainstInstallment, actualOutstanding),
        );
        let available = appliedToDebt;
        let allocationSequence = 1;
        const allocationRows: Prisma.PaymentAllocationCreateManyInput[] = [];

        const event = await this.appendEvent(tx, {
          obligationId: obligation.id,
          type: 'PAYMENT_RECEIVED',
          effectiveAt: new Date(),
          actor: { id: 'PAYROLL', type: EventActorType.PAYROLL },
          correlationId: `receipt:${receipt.id}`,
          idempotencyKey: `payment-received:${receipt.id}`,
          payload: {
            receiptId: receipt.id,
            installmentId: installment.id,
            period: input.period.toUpperCase(),
            amount: receiptAmount.toFixed(2),
            receivedAgainstInstallment: receivedAgainstInstallment.toFixed(2),
            appliedToDebt: appliedToDebt.toFixed(2),
          },
        });

        const loans = await tx.loan.findMany({
          where: { borrowerId: input.userId, status: 'DISBURSED' },
          orderBy: { disbursementDate: 'asc' },
        });
        let penaltyPaid = new Prisma.Decimal(0);
        let interestPaid = new Prisma.Decimal(0);

        penaltyPaid = money(
          Prisma.Decimal.min(available, obligation.penaltyOutstanding),
        );
        let legacyPenaltyRemaining = penaltyPaid;
        for (const loan of loans) {
          if (legacyPenaltyRemaining.lte(0)) break;
          const loanPenalty = money(
            Prisma.Decimal.max(loan.penalty.sub(loan.penaltyRepaid), 0),
          );
          const paid = money(
            Prisma.Decimal.min(legacyPenaltyRemaining, loanPenalty),
          );
          if (paid.lte(0)) continue;
          await tx.loan.update({
            where: { id: loan.id },
            data: { penaltyRepaid: { increment: paid } },
          });
          legacyPenaltyRemaining = legacyPenaltyRemaining.sub(paid);
        }
        if (penaltyPaid.gt(0)) {
          allocationRows.push({
            id: generateId.anyId('ALC', 10),
            receiptId: receipt.id,
            obligationId: obligation.id,
            installmentId: installment.id,
            component: 'PENALTY',
            amount: penaltyPaid,
            sequence: allocationSequence++,
            eventId: event.id,
          });
          await tx.penaltyEntry.create({
            data: {
              id: generateId.anyId('PEN', 10),
              obligationId: obligation.id,
              installmentId: installment.id,
              eventId: event.id,
              entryType: 'PAYMENT',
              amount: penaltyPaid,
              effectiveAt: new Date(),
              reasonCode: 'PAYROLL_PAYMENT',
              actorId: 'PAYROLL',
            },
          });
          available = available.sub(penaltyPaid);
        }

        for (const loan of loans) {
          if (available.lte(0)) break;
          const contractualOwed = money(
            Prisma.Decimal.max(loan.repayable.sub(loan.repaid), 0),
          );
          const paid = money(Prisma.Decimal.min(available, contractualOwed));
          if (paid.lte(0)) continue;

          const totalInterest = Prisma.Decimal.max(
            loan.repayable.sub(loan.principal),
            0,
          );
          const interestAlreadyPaid = Prisma.Decimal.min(
            loan.repaid,
            totalInterest,
          );
          const interestOutstanding = money(
            Prisma.Decimal.max(totalInterest.sub(interestAlreadyPaid), 0),
          );
          const interest = money(Prisma.Decimal.min(paid, interestOutstanding));
          const principal = money(paid.sub(interest));
          const newRepaid = loan.repaid.add(paid);
          const remainingPenalty = loan.penalty.sub(loan.penaltyRepaid);

          await tx.loan.update({
            where: { id: loan.id },
            data: {
              repaid: newRepaid,
              ...(newRepaid.gte(loan.repayable) && remainingPenalty.lte(0)
                ? { status: 'REPAID' }
                : {}),
            },
          });
          if (interest.gt(0)) {
            allocationRows.push({
              id: generateId.anyId('ALC', 10),
              receiptId: receipt.id,
              obligationId: obligation.id,
              installmentId: installment.id,
              loanId: loan.id,
              component: 'INTEREST',
              amount: interest,
              sequence: allocationSequence++,
              eventId: event.id,
            });
          }
          if (principal.gt(0)) {
            allocationRows.push({
              id: generateId.anyId('ALC', 10),
              receiptId: receipt.id,
              obligationId: obligation.id,
              installmentId: installment.id,
              loanId: loan.id,
              component: 'PRINCIPAL',
              amount: principal,
              sequence: allocationSequence++,
              eventId: event.id,
            });
          }
          interestPaid = interestPaid.add(interest);
          available = available.sub(paid);
        }
        await this.settleFullyPaidLoans(tx, input.userId);

        const credit = money(receiptAmount.sub(appliedToDebt));
        if (credit.gt(0)) {
          allocationRows.push({
            id: generateId.anyId('ALC', 10),
            receiptId: receipt.id,
            obligationId: obligation.id,
            installmentId: installment.id,
            component: 'CREDIT',
            amount: credit,
            sequence: allocationSequence++,
            eventId: event.id,
          });
        }
        if (allocationRows.length > 0) {
          await tx.paymentAllocation.createMany({ data: allocationRows });
        }

        const newPaid = installment.paidAmount.add(receivedAgainstInstallment);
        const installmentStatus = newPaid.gte(
          installment.totalExpected.sub(installment.waivedAmount),
        )
          ? InstallmentStatus.PAID
          : InstallmentStatus.PARTIAL;
        await tx.repaymentInstallment.update({
          where: { id: installment.id },
          data: { paidAmount: newPaid, status: installmentStatus },
        });
        const newContractualOutstanding = money(
          Prisma.Decimal.max(
            obligation.contractualOutstanding.sub(
              appliedToDebt.sub(penaltyPaid),
            ),
            0,
          ),
        );
        const newPenaltyOutstanding = money(
          Prisma.Decimal.max(obligation.penaltyOutstanding.sub(penaltyPaid), 0),
        );
        await tx.repaymentObligation.update({
          where: { id: obligation.id },
          data: {
            contractualOutstanding: newContractualOutstanding,
            penaltyOutstanding: newPenaltyOutstanding,
            creditBalance: { increment: credit },
            ...(newContractualOutstanding.eq(0) && newPenaltyOutstanding.eq(0)
              ? { status: 'SETTLED', settledAt: new Date() }
              : {}),
          },
        });
        await tx.paymentReceipt.update({
          where: { id: receipt.id },
          data: {
            status: credit.gt(0) ? 'PARTIALLY_ALLOCATED' : 'ALLOCATED',
          },
        });

        const compatibility = await tx.repayment.findFirst({
          where: { installmentId: installment.id },
          select: { id: true },
        });
        if (compatibility) {
          await tx.repayment.update({
            where: { id: compatibility.id },
            data: {
              amount: receiptAmount,
              repaidAmount: newPaid,
              interestPaid: { increment: interestPaid },
              receiptId: receipt.id,
              status:
                installmentStatus === InstallmentStatus.PAID
                  ? 'FULFILLED'
                  : 'PARTIAL',
            },
          });
        }

        return {
          duplicate: false,
          receiptId: receipt.id,
          applied: appliedToDebt.toNumber(),
          credit: credit.toNumber(),
          penaltyPaid: penaltyPaid.toNumber(),
          interestPaid: interestPaid.toNumber(),
        };
      },
      FINANCIAL_TRANSACTION_OPTIONS,
    );
  }

  async closeRepaymentPeriod(period: string, penaltyRate: number) {
    const periodDate = canonicalPeriod(parsePeriodToDate(period));
    const openInstallments = await this.prisma.repaymentInstallment.findMany({
      where: {
        period: periodDate,
        closedAt: null,
        OR: [
          {
            status: InstallmentStatus.PLANNED,
            plan: { status: PlanStatus.PUBLISHED },
          },
          {
            status: {
              in: [InstallmentStatus.PUBLISHED, InstallmentStatus.PARTIAL],
            },
          },
        ],
      },
      select: { id: true },
    });
    let totalPenalty = new Prisma.Decimal(0);
    let defaults = 0;
    const notifications: Array<{
      userId: string;
      expected: number;
      paid: number;
      shortfall: number;
      penalty: number;
    }> = [];

    for (const { id } of openInstallments) {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const installment = await tx.repaymentInstallment.findUniqueOrThrow({
            where: { id },
            include: {
              obligation: true,
              plan: true,
            },
          });
          const shortfall = money(
            Prisma.Decimal.max(
              installment.totalExpected
                .sub(installment.paidAmount)
                .sub(installment.waivedAmount),
              0,
            ),
          );
          if (shortfall.lte(0)) {
            await tx.repaymentInstallment.update({
              where: { id },
              data: { status: InstallmentStatus.PAID, closedAt: new Date() },
            });
            return {
              defaulted: false,
              penalty: new Prisma.Decimal(0),
              userId: installment.obligation.borrowerId,
              expected: installment.totalExpected,
              paid: installment.paidAmount,
              shortfall,
            };
          }

          const penalty = money(shortfall.mul(penaltyRate));
          const event = await this.appendEvent(tx, {
            obligationId: installment.obligationId,
            type: 'INSTALLMENT_DEFAULTED',
            effectiveAt: installment.dueDate,
            actor: { id: 'PERIOD_CLOSE', type: EventActorType.SYSTEM },
            correlationId: `period-close:${period}:${installment.obligationId}`,
            idempotencyKey: `installment-default:${installment.id}:DEFAULT_EXTENSION_V1`,
            policyVersion: 'DEFAULT_EXTENSION_V1',
            payload: {
              installmentId: installment.id,
              expected: installment.totalExpected.toFixed(2),
              paid: installment.paidAmount.toFixed(2),
              waived: installment.waivedAmount.toFixed(2),
              shortfall: shortfall.toFixed(2),
              penaltyRate,
              penalty: penalty.toFixed(2),
            },
          });

          if (penalty.gt(0)) {
            await tx.penaltyEntry.create({
              data: {
                id: generateId.anyId('PEN', 10),
                obligationId: installment.obligationId,
                installmentId: installment.id,
                eventId: event.id,
                entryType: 'ASSESSMENT',
                amount: penalty,
                effectiveAt: installment.dueDate,
                reasonCode: 'INSTALLMENT_SHORTFALL',
                actorId: 'PERIOD_CLOSE',
              },
            });
            const oldestLoan = await tx.loan.findFirst({
              where: {
                borrowerId: installment.obligation.borrowerId,
                status: 'DISBURSED',
              },
              orderBy: { disbursementDate: 'asc' },
              select: { id: true },
            });
            if (oldestLoan) {
              await tx.loan.update({
                where: { id: oldestLoan.id },
                data: { penalty: { increment: penalty } },
              });
            }
          }

          await tx.repaymentInstallment.update({
            where: { id: installment.id },
            data: {
              status: installment.paidAmount.gt(0)
                ? InstallmentStatus.PARTIAL
                : InstallmentStatus.MISSED,
              closedAt: new Date(),
            },
          });
          await tx.repaymentObligation.update({
            where: { id: installment.obligationId },
            data: { penaltyOutstanding: { increment: penalty } },
          });
          const compatibility = await tx.repayment.findFirst({
            where: { installmentId: installment.id },
            select: { id: true },
          });
          if (compatibility) {
            await tx.repayment.update({
              where: { id: compatibility.id },
              data: {
                status: installment.paidAmount.gt(0) ? 'PARTIAL' : 'FAILED',
                penaltyCharge: penalty,
                failureNote: `Payment shortfall for ${period}: ${shortfall.toFixed(2)}`,
              },
            });
          }

          const penaltyAfterDefault = installment.obligation.penaltyOutstanding.add(
            penalty,
          );
          if (
            installment.obligation.contractualOutstanding.gt(0) ||
            penaltyAfterDefault.gt(0)
          ) {
            const remaining = await tx.repaymentInstallment.count({
              where: {
                obligationId: installment.obligationId,
                period: { gt: periodDate },
                status: {
                  in: [InstallmentStatus.PLANNED, InstallmentStatus.PUBLISHED],
                },
                plan: { status: PlanStatus.PUBLISHED },
              },
            });
            const effectiveFrom = await this.nextUnpublishedPeriodInTx(
              tx,
              periodDate,
            );
            await this.publishPlan(tx, {
              obligationId: installment.obligationId,
              scheduledBalance: installment.obligation.contractualOutstanding,
              penaltyBalance: penaltyAfterDefault,
              termMonths: Math.max(1, remaining + 1),
              effectiveFrom,
              reason: PlanReason.DEFAULT_EXTENSION,
              policyName: 'DEFAULT_EXTENSION',
              policyVersion: 'DEFAULT_EXTENSION_V1',
              actor: { id: 'PERIOD_CLOSE', type: EventActorType.SYSTEM },
              triggerEventSequence: event.sequence,
              snapshot: {
                installmentId: installment.id,
                shortfall: shortfall.toFixed(2),
                penalty: penalty.toFixed(2),
                previousRemainingTerm: remaining,
                extendedRemainingTerm: Math.max(1, remaining + 1),
              },
            });
          }
          return {
            defaulted: true,
            penalty,
            userId: installment.obligation.borrowerId,
            expected: installment.totalExpected,
            paid: installment.paidAmount,
            shortfall,
          };
        },
        FINANCIAL_TRANSACTION_OPTIONS,
      );
      totalPenalty = totalPenalty.add(result.penalty);
      if (result.defaulted) {
        defaults++;
        notifications.push({
          userId: result.userId,
          expected: result.expected.toNumber(),
          paid: result.paid.toNumber(),
          shortfall: result.shortfall.toNumber(),
          penalty: result.penalty.toNumber(),
        });
      }
    }

    return { totalPenalty: money(totalPenalty), defaults, notifications };
  }

  async applyUnscheduledPayment(input: {
    userId: string;
    amount: Prisma.Decimal.Value;
    source: 'LIQUIDATION' | 'OVERFLOW' | 'MANUAL';
    externalReference: string;
    actorId: string;
    period?: string;
    compatibilityRepaymentId?: string;
    liquidationRequestId?: string;
    resolutionNote?: string;
  }) {
    const receiptAmount = money(input.amount);
    if (receiptAmount.lte(0)) {
      throw new BadRequestException('Payment amount must be positive');
    }
    const periodDate = input.period
      ? canonicalPeriod(parsePeriodToDate(input.period))
      : canonicalPeriod(new Date());

    return this.prisma.$transaction(
      async (tx) => {
        const effectivePeriod = await this.nextUnpublishedPeriodInTx(
          tx,
          new Date(),
        );
        const liquidationTarget = input.liquidationRequestId
          ? await tx.liquidationRequest.findUnique({
              where: { id: input.liquidationRequestId },
              select: { obligationId: true, customerId: true },
            })
          : null;
        if (input.liquidationRequestId && !liquidationTarget) {
          throw new NotFoundException('Liquidation request not found');
        }
        if (
          liquidationTarget &&
          liquidationTarget.customerId !== input.userId
        ) {
          throw new ConflictException(
            'Liquidation request does not belong to this borrower',
          );
        }
        const obligation = await tx.repaymentObligation.findFirst({
          where: liquidationTarget?.obligationId
            ? { id: liquidationTarget.obligationId }
            : {
                borrowerId: input.userId,
                status: { not: 'CLOSED' },
              },
          orderBy: { openedAt: 'desc' },
          include: {
            currentPlan: {
              include: {
                installments: {
                  where: {
                    period: { gte: effectivePeriod },
                    status: {
                      in: [
                        InstallmentStatus.PLANNED,
                        InstallmentStatus.PUBLISHED,
                      ],
                    },
                  },
                },
              },
            },
          },
        });
        if (!obligation) {
          throw new NotFoundException('Repayment obligation not found');
        }
        const idempotencyKey = `${input.source.toLowerCase()}:${input.externalReference}`;
        const duplicate = await tx.paymentReceipt.findUnique({
          where: { idempotencyKey },
          include: { allocations: true },
        });
        if (duplicate) {
          const applied = duplicate.allocations.reduce(
            (sum, item) =>
              item.component === 'CREDIT' ? sum : sum.add(item.amount),
            new Prisma.Decimal(0),
          );
          return {
            duplicate: true,
            receiptId: duplicate.id,
            applied,
            credit: duplicate.amount.sub(applied),
            penaltyPaid: duplicate.allocations
              .filter((item) => item.component === 'PENALTY')
              .reduce(
                (sum, item) => sum.add(item.amount),
                new Prisma.Decimal(0),
              ),
            interestPaid: duplicate.allocations
              .filter((item) => item.component === 'INTEREST')
              .reduce(
                (sum, item) => sum.add(item.amount),
                new Prisma.Decimal(0),
              ),
          };
        }

        const totalOutstanding = obligation.contractualOutstanding.add(
          obligation.penaltyOutstanding,
        );
        const applied = money(
          Prisma.Decimal.min(receiptAmount, totalOutstanding),
        );
        const credit = money(receiptAmount.sub(applied));
        const receipt = await tx.paymentReceipt.create({
          data: {
            id: generateId.anyId('RCT', 10),
            obligationId: obligation.id,
            source: input.source,
            period: periodDate,
            amount: receiptAmount,
            externalReference: input.externalReference,
            idempotencyKey,
            status: 'MATCHED',
            receivedAt: new Date(),
            rawPayload: this.json({
              liquidationRequestId: input.liquidationRequestId ?? null,
              resolutionNote: input.resolutionNote ?? null,
            }),
          },
        });
        const event = await this.appendEvent(tx, {
          obligationId: obligation.id,
          type:
            input.source === 'LIQUIDATION'
              ? 'LIQUIDATION_APPLIED'
              : 'PAYMENT_RECEIVED',
          effectiveAt: new Date(),
          actor: { id: input.actorId, type: EventActorType.ADMIN },
          correlationId: `receipt:${receipt.id}`,
          idempotencyKey: `unscheduled-payment:${receipt.id}`,
          policyVersion: 'LIQUIDATION_V1',
          payload: {
            receiptId: receipt.id,
            source: input.source,
            amount: receiptAmount.toFixed(2),
            applied: applied.toFixed(2),
            credit: credit.toFixed(2),
            outstandingBefore: totalOutstanding.toFixed(2),
          },
        });

        let available = applied;
        let penaltyPaid = new Prisma.Decimal(0);
        let interestPaid = new Prisma.Decimal(0);
        let sequence = 1;
        const allocations: Prisma.PaymentAllocationCreateManyInput[] = [];
        const loans = await tx.loan.findMany({
          where: { borrowerId: input.userId, status: 'DISBURSED' },
          orderBy: { disbursementDate: 'asc' },
        });

        penaltyPaid = money(
          Prisma.Decimal.min(available, obligation.penaltyOutstanding),
        );
        let legacyPenaltyRemaining = penaltyPaid;
        for (const loan of loans) {
          if (legacyPenaltyRemaining.lte(0)) break;
          const outstanding = money(
            Prisma.Decimal.max(loan.penalty.sub(loan.penaltyRepaid), 0),
          );
          const amount = money(
            Prisma.Decimal.min(legacyPenaltyRemaining, outstanding),
          );
          if (amount.lte(0)) continue;
          await tx.loan.update({
            where: { id: loan.id },
            data: { penaltyRepaid: { increment: amount } },
          });
          legacyPenaltyRemaining = legacyPenaltyRemaining.sub(amount);
        }
        if (penaltyPaid.gt(0)) {
          allocations.push({
            id: generateId.anyId('ALC', 10),
            receiptId: receipt.id,
            obligationId: obligation.id,
            component: 'PENALTY',
            amount: penaltyPaid,
            sequence: sequence++,
            eventId: event.id,
          });
          await tx.penaltyEntry.create({
            data: {
              id: generateId.anyId('PEN', 10),
              obligationId: obligation.id,
              eventId: event.id,
              entryType: 'PAYMENT',
              amount: penaltyPaid,
              effectiveAt: new Date(),
              reasonCode: `${input.source}_PAYMENT`,
              actorId: input.actorId,
            },
          });
          available = available.sub(penaltyPaid);
        }

        for (const loan of loans) {
          if (available.lte(0)) break;
          const outstanding = money(
            Prisma.Decimal.max(loan.repayable.sub(loan.repaid), 0),
          );
          const amount = money(Prisma.Decimal.min(available, outstanding));
          if (amount.lte(0)) continue;
          const totalInterest = Prisma.Decimal.max(
            loan.repayable.sub(loan.principal),
            0,
          );
          const interestAlreadyPaid = Prisma.Decimal.min(
            loan.repaid,
            totalInterest,
          );
          const interestOutstanding = money(
            Prisma.Decimal.max(totalInterest.sub(interestAlreadyPaid), 0),
          );
          const interest = money(
            Prisma.Decimal.min(amount, interestOutstanding),
          );
          const principal = money(amount.sub(interest));
          const newRepaid = loan.repaid.add(amount);
          const penaltyAfter = loan.penalty.sub(loan.penaltyRepaid);

          await tx.loan.update({
            where: { id: loan.id },
            data: {
              repaid: newRepaid,
              ...(newRepaid.gte(loan.repayable) && penaltyAfter.lte(0)
                ? { status: 'REPAID' }
                : {}),
            },
          });
          if (interest.gt(0)) {
            allocations.push({
              id: generateId.anyId('ALC', 10),
              receiptId: receipt.id,
              obligationId: obligation.id,
              loanId: loan.id,
              component: 'INTEREST',
              amount: interest,
              sequence: sequence++,
              eventId: event.id,
            });
          }
          if (principal.gt(0)) {
            allocations.push({
              id: generateId.anyId('ALC', 10),
              receiptId: receipt.id,
              obligationId: obligation.id,
              loanId: loan.id,
              component: 'PRINCIPAL',
              amount: principal,
              sequence: sequence++,
              eventId: event.id,
            });
          }
          interestPaid = interestPaid.add(interest);
          available = available.sub(amount);
        }
        await this.settleFullyPaidLoans(tx, input.userId);
        if (credit.gt(0)) {
          allocations.push({
            id: generateId.anyId('ALC', 10),
            receiptId: receipt.id,
            obligationId: obligation.id,
            component: 'CREDIT',
            amount: credit,
            sequence: sequence++,
            eventId: event.id,
          });
        }
        if (allocations.length > 0) {
          await tx.paymentAllocation.createMany({ data: allocations });
        }

        const newContractual = money(
          Prisma.Decimal.max(
            obligation.contractualOutstanding.sub(applied.sub(penaltyPaid)),
            0,
          ),
        );
        const newPenalty = money(
          Prisma.Decimal.max(obligation.penaltyOutstanding.sub(penaltyPaid), 0),
        );
        await tx.repaymentObligation.update({
          where: { id: obligation.id },
          data: {
            contractualOutstanding: newContractual,
            penaltyOutstanding: newPenalty,
            creditBalance: { increment: credit },
            ...(newContractual.eq(0) && newPenalty.eq(0)
              ? { status: 'SETTLED', settledAt: new Date() }
              : {}),
          },
        });
        await tx.paymentReceipt.update({
          where: { id: receipt.id },
          data: {
            status: credit.gt(0) ? 'PARTIALLY_ALLOCATED' : 'ALLOCATED',
          },
        });

        if (input.compatibilityRepaymentId) {
          await tx.repayment.update({
            where: { id: input.compatibilityRepaymentId },
            data: {
              failureNote: null,
              resolutionNote: input.resolutionNote,
              userId: input.userId,
              obligationId: obligation.id,
              receiptId: receipt.id,
              repaidAmount: applied,
              expectedAmount: applied,
              interestPaid,
              status: 'FULFILLED',
            },
          });
        } else {
          await tx.repayment.create({
            data: {
              id: generateId.repaymentId(),
              amount: receiptAmount,
              expectedAmount: applied,
              repaidAmount: applied,
              penaltyCharge: penaltyPaid,
              interestPaid,
              period: input.period ?? parseDateToPeriod(periodDate),
              periodInDT: periodDate,
              status: 'FULFILLED',
              source: input.source,
              userId: input.userId,
              obligationId: obligation.id,
              receiptId: receipt.id,
              liquidationRequestId: input.liquidationRequestId,
              resolutionNote: input.resolutionNote,
            },
          });
        }

        const futureBalances = await this.balancesAvailableForFuturePlan(
          tx,
          obligation.id,
          effectivePeriod,
          newContractual,
          newPenalty,
        );
        if (futureBalances.contractual.gt(0) || futureBalances.penalty.gt(0)) {
          const remainingTerm = Math.max(
            1,
            obligation.currentPlan?.installments.length ?? 1,
          );
          await this.publishPlan(tx, {
            obligationId: obligation.id,
            scheduledBalance: futureBalances.contractual,
            penaltyBalance: futureBalances.penalty,
            termMonths: remainingTerm,
            effectiveFrom: effectivePeriod,
            reason: PlanReason.LIQUIDATION,
            policyName: 'LIQUIDATION_RECAST',
            policyVersion: 'LIQUIDATION_V1',
            actor: { id: input.actorId, type: EventActorType.ADMIN },
            triggerEventSequence: event.sequence,
            snapshot: {
              receiptId: receipt.id,
              source: input.source,
              amount: receiptAmount.toFixed(2),
              applied: applied.toFixed(2),
              remainingTerm,
              actualContractualOutstanding: newContractual.toFixed(2),
              futureScheduledBalance: futureBalances.contractual.toFixed(2),
              frozenPublishedContractual:
                futureBalances.frozenContractual.toFixed(2),
            },
          });
        } else {
          await this.supersedeFuturePlanWithoutReplacement(
            tx,
            obligation.id,
            obligation.currentPlanId,
            effectivePeriod,
          );
        }

        return {
          duplicate: false,
          receiptId: receipt.id,
          applied,
          credit,
          penaltyPaid,
          interestPaid,
        };
      },
      FINANCIAL_TRANSACTION_OPTIONS,
    );
  }

  periodLabel(date: Date) {
    return parseDateToPeriod(date);
  }
}
