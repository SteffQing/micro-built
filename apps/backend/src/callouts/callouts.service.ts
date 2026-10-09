import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import type { Queue } from 'bull';
import { captureJobError } from 'src/common/observability';
import type { AccessRole } from 'src/common/types';
import { MaintenanceQueueName, QueueName } from 'src/common/types/queue.interface';
import { PrismaService } from 'src/database/prisma.service';
import { CALLOUT_LIFETIME_DAYS } from './callouts.dto';
import type { CalloutDto, CreateCalloutDto, UpdateCalloutDto, ViewerCalloutDto } from './callouts.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many callouts a viewer has at once. */
export const CALLOUTS_PER_VIEWER = 3;

/** A callout's lifetime from `from`: it is deleted then, unless it's pinned. */
export const lifetimeFrom = (from: Date) => new Date(from.getTime() + CALLOUT_LIFETIME_DAYS * DAY_MS);

const VIEWER = { id: true, kind: true, title: true, body: true, highlight: true, pinned: true } satisfies Prisma.CalloutSelect;

const FULL = {
  ...VIEWER,
  priority: true,
  status: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { user: { select: { name: true } } } },
} satisfies Prisma.CalloutSelect;

type FullRow = Prisma.CalloutGetPayload<{ select: typeof FULL }>;

// A pinned callout never expires, so it has no date to show.
const toDto = ({ createdBy, expiresAt, ...row }: FullRow): CalloutDto => ({
  ...row,
  createdBy: createdBy.user.name,
  expiresAt: row.pinned ? null : expiresAt,
});

/** What changed, for the audit note and the response message: "published, pinned". */
export function describeChange(before: CalloutDto, after: CalloutDto): string[] {
  const changes: string[] = [];
  if (before.status !== after.status) changes.push(after.status === 'PUBLISHED' ? 'published' : 'unpublished');
  if (before.pinned !== after.pinned) changes.push(after.pinned ? 'pinned' : 'unpinned');
  else if (!after.pinned && String(before.expiresAt) !== String(after.expiresAt)) changes.push('renewed');
  const edited =
    before.title !== after.title ||
    before.body !== after.body ||
    before.highlight !== after.highlight ||
    before.kind !== after.kind ||
    before.priority !== after.priority;
  if (edited) changes.push('edited');
  return changes;
}

// Callouts: short pieces of content at the foot of the customer sidebar (customers only; staff and marketers have
// none). A customer gets at most three published ones, the pinned one first, then by priority and the most recently
// published.
//
// Every callout but the pinned one is deleted 7 days after it's created: a delayed `callout_expire` job is queued for
// that moment (an hourly `callout_sweep` catches any job Redis lost), and until it runs, viewers never see one past its
// date. Renewing starts the 7 days again; unpinning gives a callout a fresh 7 days.
//
// Which ones a viewer dismissed lives in their browser and comes here only as `exclude`, so the next eligible ones fill
// in; a pinned callout can't be dismissed, so it's never left out.
@Injectable()
export class CalloutsService {
  private readonly logger = new Logger(CalloutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QueueName.maintenance) private readonly queue: Queue,
  ) {}

  async forViewer(role: AccessRole, exclude: string[] = []): Promise<ViewerCalloutDto[]> {
    if (role !== 'CUSTOMER') return [];
    return this.prisma.callout.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [{ pinned: true }, { expiresAt: { gt: new Date() } }],
        ...(exclude.length && { NOT: { id: { in: exclude }, pinned: false } }),
      },
      orderBy: [{ pinned: 'desc' }, { priority: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }],
      take: CALLOUTS_PER_VIEWER,
      select: VIEWER,
    });
  }

  async list(): Promise<CalloutDto[]> {
    const rows = await this.prisma.callout.findMany({
      orderBy: [{ pinned: 'desc' }, { status: 'desc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
      select: FULL,
    });
    return rows.map(toDto);
  }

  async get(id: string): Promise<CalloutDto> {
    const row = await this.prisma.callout.findUnique({ where: { id }, select: FULL });
    if (!row) throw new NotFoundException('Callout not found');
    return toDto(row);
  }

  async create(dto: CreateCalloutDto, actorId: string): Promise<CalloutDto> {
    const status = dto.status ?? 'DRAFT';
    const pinned = dto.pinned ?? false;
    this.check({ status, pinned });
    const now = new Date();
    const callout = await this.pinSafely(pinned, null, (tx) =>
      tx.callout.create({
        data: {
          kind: dto.kind,
          title: dto.title,
          body: dto.body,
          highlight: dto.highlight || null,
          priority: dto.priority ?? 1,
          status,
          pinned,
          publishedAt: status === 'PUBLISHED' ? now : null,
          expiresAt: lifetimeFrom(now),
          createdById: actorId,
        },
        select: FULL,
      }),
    );
    if (!pinned) await this.scheduleExpiry(callout.id, lifetimeFrom(now));
    return callout;
  }

  async update(id: string, dto: UpdateCalloutDto): Promise<{ before: CalloutDto; after: CalloutDto }> {
    const before = await this.get(id);
    const status = dto.status ?? before.status;
    // Taking a callout down unpins it; pinning one that isn't published is refused below.
    const pinned = status === 'PUBLISHED' ? (dto.pinned ?? before.pinned) : false;
    this.check({ status, pinned: dto.pinned === true ? true : pinned });

    // Renewing, or letting go of the pin, starts a fresh 7 days.
    const restart = !pinned && (dto.renew || before.pinned);
    const expiresAt = restart ? lifetimeFrom(new Date()) : null;

    const after = await this.pinSafely(pinned && !before.pinned, id, (tx) =>
      tx.callout.update({
        where: { id },
        data: {
          ...(dto.kind && { kind: dto.kind }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.body !== undefined && { body: dto.body }),
          ...(dto.highlight !== undefined && { highlight: dto.highlight || null }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          status,
          pinned,
          ...(expiresAt && { expiresAt }),
          // Publishing again counts as new: it goes ahead of callouts published before it.
          ...(status === 'PUBLISHED' && before.status !== 'PUBLISHED' && { publishedAt: new Date() }),
        },
        select: FULL,
      }),
    );
    if (expiresAt) await this.scheduleExpiry(id, expiresAt);
    return { before, after };
  }

  async remove(id: string): Promise<CalloutDto> {
    const callout = await this.get(id);
    if (callout.pinned) throw new ConflictException('A pinned callout stays until you unpin it');
    await this.prisma.callout.delete({ where: { id } });
    return callout;
  }

  /**
   * The queue's side: deletes what has passed its date and isn't pinned (one callout, or all of them for the sweep),
   * recording each deletion as the SYSTEM admin's. A callout renewed or pinned since its job was queued is left alone.
   */
  async deleteExpired(id?: string): Promise<string[]> {
    const due = await this.prisma.callout.findMany({
      where: { ...(id && { id }), pinned: false, expiresAt: { lte: new Date() } },
      select: { id: true, title: true },
    });
    if (!due.length) return [];
    const system = await this.prisma.admin.findFirst({ where: { role: AdminRole.SYSTEM }, select: { userId: true } });
    await this.prisma.$transaction(async (tx) => {
      // Checked again inside the transaction, so a renewal at the same moment wins.
      const { count } = await tx.callout.deleteMany({
        where: { id: { in: due.map((c) => c.id) }, pinned: false, expiresAt: { lte: new Date() } },
      });
      if (count && system) {
        await tx.auditLog.createMany({
          data: due.map((c) => ({
            actorId: system.userId,
            action: 'CALLOUT_DELETED' as const,
            entityType: 'CALLOUT' as const,
            entityId: c.id,
            note: `${c.title} (expired after ${CALLOUT_LIFETIME_DAYS} days)`,
          })),
        });
      }
    });
    return due.map((c) => c.id);
  }

  /** Queues the callout's deletion for `at`. Without Redis it's reported, not thrown: the hourly sweep catches it. */
  private async scheduleExpiry(id: string, at: Date) {
    try {
      await this.queue.add(
        MaintenanceQueueName.callout_expire,
        { calloutId: id },
        {
          delay: Math.max(0, at.getTime() - Date.now()),
          jobId: `callout-expire:${id}:${at.getTime()}`,
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      this.logger.error(`Queuing the expiry of callout ${id} failed`, error instanceof Error ? error.stack : String(error));
      captureJobError(error, { queue: QueueName.maintenance, job: MaintenanceQueueName.callout_expire });
    }
  }

  private check({ status, pinned }: { status: string; pinned: boolean }) {
    if (pinned && status !== 'PUBLISHED') throw new BadRequestException('Only a published callout can be pinned');
  }

  /**
   * Writes the callout; when it takes the pin, the callout that had it lets go in the same transaction, with a fresh 7
   * days (queued once the transaction is in).
   */
  private async pinSafely(takesPin: boolean, id: string | null, write: (tx: Prisma.TransactionClient) => Promise<FullRow>) {
    let released: { id: string; expiresAt: Date } | null = null;
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (takesPin) {
          const previous = await tx.callout.findFirst({
            where: { pinned: true, ...(id && { id: { not: id } }) },
            select: { id: true },
          });
          if (previous) {
            released = { id: previous.id, expiresAt: lifetimeFrom(new Date()) };
            await tx.callout.update({
              where: { id: previous.id },
              data: { pinned: false, expiresAt: released.expiresAt },
            });
          }
        }
        return write(tx);
      });
      const done = released as { id: string; expiresAt: Date } | null;
      if (done) await this.scheduleExpiry(done.id, done.expiresAt);
      return toDto(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // The one-pinned index: someone pinned another callout at the same moment.
        if (error.code === 'P2002') throw new ConflictException('Another callout was pinned just now. Try again.');
        if (error.code === 'P2025') throw new NotFoundException('Callout not found');
      }
      throw error;
    }
  }
}
