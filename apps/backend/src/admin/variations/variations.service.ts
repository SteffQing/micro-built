import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parseYm, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { toNumber } from 'src/ledger/money';
import {
  VARIATIONS_BUCKET,
  VariationService,
  type VariationLock,
  type VariationState,
} from 'src/ledger/variation.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import type {
  GenerateVariationsDto,
  VariationDraftDto,
  VariationFileQueryDto,
  VariationHistoryQueryDto,
  VariationsQueryDto,
} from './variations.dto';
import type {
  GenerateVariationsResultDto,
  OrganizationVariationDto,
  VariationDraftResultDto,
  VariationFileUrlDto,
  VariationHistoryItemDto,
  VariationLockDto,
  VariationMonthDto,
  VariationStateDto,
} from './variations.entity';

/** Seconds a variation file link stays valid. */
export const VARIATION_FILE_URL_TTL = 10 * 60;

const month = (period: Period): VariationMonthDto => ({ ym: toYm(period), label: periodLabel(period) });

function lockDto(lock: VariationLock | null): VariationLockDto | null {
  if (!lock) return null;
  return lock.kind === 'VOUCHER'
    ? { kind: 'VOUCHER', voucherId: lock.voucherId, filename: lock.filename, uploadedAt: lock.uploadedAt.toISOString() }
    : { kind: 'NO_PAYROLL', reason: lock.reason };
}

function stateDto(state: VariationState): VariationStateDto {
  return {
    id: state.id,
    version: state.version,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
    lock: lockDto(state.lock),
    regenerateHint: state.regenerateHint,
    versions: state.versions,
  };
}

// /admin/variations (PLAN_V2 §2): what the ledger's VariationService works out, in the shapes the frontend reads.
// Generating is queued, one job per organization (QueueProducer.queueVariationGenerate), after a synchronous check
// that sorts each organization into skipped, refused (with the reason) or queued.
@Injectable()
export class VariationsAdminService {
  private readonly logger = new Logger(VariationsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly variations: VariationService,
    private readonly supabase: SupabaseService,
    private readonly queue: QueueProducer,
  ) {}

  async preview(query: VariationsQueryDto): Promise<OrganizationVariationDto> {
    const preview = await this.variations.preview(query.organizationId, parseYm(query.period), {
      action: query.action,
      reason: query.reason,
    });
    return {
      organization: preview.organization,
      period: { ym: preview.period.ym, label: preview.period.label },
      variation: preview.variation ? stateDto(preview.variation) : null,
      rows: preview.rows.map((row) => ({ ...row, balance: toNumber(row.balance), amount: toNumber(row.amount) })),
      counts: preview.counts,
      frozen: preview.frozen,
      skipped: preview.skipped,
      generateBlockedBy: preview.generateBlockedBy,
    };
  }

  async history(query: VariationHistoryQueryDto): Promise<VariationHistoryItemDto[]> {
    const history = await this.variations.history(query.organizationId);
    return history.map((variation) => ({
      id: variation.id,
      period: { ym: variation.period.ym, label: variation.period.label },
      version: variation.version,
      updatedAt: variation.updatedAt.toISOString(),
      lock: lockDto(variation.lock),
    }));
  }

  /**
   * Sorts each organization, then queues a job for those that can go ahead. The check runs here so the admin
   * sees at once who was refused and why; the job checks again inside its transaction.
   */
  async generate(dto: GenerateVariationsDto, requestedById: string): Promise<GenerateVariationsResultDto> {
    const named = dto.organizationIds?.length ?? 0;
    if (dto.all && named > 0) throw new BadRequestException('Choose some organizations or all of them, not both');
    if (!dto.all && named === 0) throw new BadRequestException('Choose the organizations to generate for, or all of them');

    const period = parseYm(dto.period);
    const result: GenerateVariationsResultDto = { period: month(period), queued: [], skipped: [], refused: [] };
    for (const organization of await this.organizationsFor(dto)) {
      const check = await this.variations.generationCheck(organization.id, period);
      if (check.skipped) {
        result.skipped.push(organization);
      } else if (check.blockedBy) {
        result.refused.push({ ...organization, reason: check.blockedBy });
      } else {
        try {
          await this.queue.queueVariationGenerate({ organizationId: organization.id, period: dto.period, requestedById });
          result.queued.push(organization);
        } catch (error) {
          this.logger.error(
            `Queueing ${organization.name}'s ${result.period.label} variation failed`,
            error instanceof Error ? error.stack : error,
          );
          result.refused.push({ ...organization, reason: 'It could not be queued. Try again.' });
        }
      }
    }
    return result;
  }

  /** Queues a draft of what generating would produce now, to `email`; nothing is frozen. */
  async draft(dto: VariationDraftDto, email: string | null, requestedById: string): Promise<VariationDraftResultDto> {
    if (!email) throw new BadRequestException('Add an email address to your account to receive drafts');
    const period = parseYm(dto.period);
    const label = periodLabel(period);
    const check = await this.variations.generationCheck(dto.organizationId, period);
    const name = check.organization.name;
    if (check.skipped) throw new ConflictException(`${name} has no deductions for ${label}: there is nothing to draft`);
    if (check.blockedBy) throw new ConflictException(check.blockedBy);
    try {
      await this.queue.generateVariationDraft({
        organizationId: dto.organizationId,
        period: dto.period,
        email,
        requestedById,
      });
    } catch (error) {
      this.logger.error(`Queueing ${name}'s ${label} variation draft failed`, error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('The draft could not be queued. Try again.');
    }
    return { period: label, organization: name, email };
  }

  /** A signed link to one stored version of the file (default: the current one). */
  async fileUrl(variationId: string, query: VariationFileQueryDto): Promise<VariationFileUrlDto> {
    const file = await this.variations.file(variationId, query.version);
    const url = await this.supabase.signedUrl(VARIATIONS_BUCKET, file.path, VARIATION_FILE_URL_TTL, file.fileName);
    return { url, expiresIn: VARIATION_FILE_URL_TTL, filename: file.fileName };
  }

  /** The organizations a generate call is for, A–Z. An unknown id fails the whole call: nothing is queued. */
  private async organizationsFor(dto: GenerateVariationsDto): Promise<{ id: string; name: string }[]> {
    const ids = dto.all ? undefined : [...new Set(dto.organizationIds)];
    const organizations = await this.prisma.organization.findMany({
      where: ids ? { id: { in: ids } } : {},
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (ids && organizations.length < ids.length) throw new NotFoundException('Organization not found');
    return organizations;
  }
}
