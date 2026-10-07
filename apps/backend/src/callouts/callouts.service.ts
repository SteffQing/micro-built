import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CalloutAudience, Prisma } from '@prisma/client';
import type { AccessRole } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import type { CalloutDto, CreateCalloutDto, UpdateCalloutDto, ViewerCalloutDto } from './callouts.dto';

/** How many callouts a viewer has at once. */
export const CALLOUTS_PER_VIEWER = 3;

const VIEWER = { id: true, kind: true, title: true, body: true, highlight: true, pinned: true } satisfies Prisma.CalloutSelect;

const FULL = {
  ...VIEWER,
  audience: true,
  priority: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { user: { select: { name: true } } } },
} satisfies Prisma.CalloutSelect;

type FullRow = Prisma.CalloutGetPayload<{ select: typeof FULL }>;

const toDto = ({ createdBy, ...row }: FullRow): CalloutDto => ({ ...row, createdBy: createdBy.user.name });

const AUDIENCES = new Set<string>(Object.values(CalloutAudience));

/** What changed, for the audit note and the response message: "published, pinned". */
export function describeChange(before: CalloutDto, after: CalloutDto): string[] {
  const changes: string[] = [];
  if (before.status !== after.status) changes.push(after.status === 'PUBLISHED' ? 'published' : 'unpublished');
  if (before.pinned !== after.pinned) changes.push(after.pinned ? 'pinned' : 'unpinned');
  const edited =
    before.title !== after.title ||
    before.body !== after.body ||
    before.highlight !== after.highlight ||
    before.kind !== after.kind ||
    before.priority !== after.priority ||
    [...before.audience].sort().join() !== [...after.audience].sort().join();
  if (edited) changes.push('edited');
  return changes;
}

// Callouts: short pieces of content at the foot of the sidebar. A viewer gets at most three published ones for their
// role, the pinned one first, then by priority and the most recently published. Which ones a viewer dismissed lives in
// their browser and comes here only as `exclude`, so the next eligible ones fill in.
@Injectable()
export class CalloutsService {
  constructor(private readonly prisma: PrismaService) {}

  async forViewer(role: AccessRole, exclude: string[] = []): Promise<ViewerCalloutDto[]> {
    if (!AUDIENCES.has(role)) return [];
    return this.prisma.callout.findMany({
      where: {
        status: 'PUBLISHED',
        audience: { has: role as CalloutAudience },
        ...(exclude.length && { id: { notIn: exclude } }),
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
    this.check({ status, pinned, audience: dto.audience });
    return this.pinSafely(pinned, null, (tx) =>
      tx.callout.create({
        data: {
          kind: dto.kind,
          title: dto.title,
          body: dto.body,
          highlight: dto.highlight || null,
          audience: dto.audience,
          priority: dto.priority ?? 1,
          status,
          pinned,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          createdById: actorId,
        },
        select: FULL,
      }),
    );
  }

  async update(id: string, dto: UpdateCalloutDto): Promise<{ before: CalloutDto; after: CalloutDto }> {
    const before = await this.get(id);
    const status = dto.status ?? before.status;
    // Taking a callout down unpins it; pinning one that isn't published is refused below.
    const pinned = status === 'PUBLISHED' ? (dto.pinned ?? before.pinned) : false;
    const audience = dto.audience ?? before.audience;
    this.check({ status, pinned: dto.pinned === true ? true : pinned, audience });

    const after = await this.pinSafely(pinned && !before.pinned, id, (tx) =>
      tx.callout.update({
        where: { id },
        data: {
          ...(dto.kind && { kind: dto.kind }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.body !== undefined && { body: dto.body }),
          ...(dto.highlight !== undefined && { highlight: dto.highlight || null }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          audience,
          status,
          pinned,
          // Publishing again counts as new: it goes ahead of callouts published before it.
          ...(status === 'PUBLISHED' && before.status !== 'PUBLISHED' && { publishedAt: new Date() }),
        },
        select: FULL,
      }),
    );
    return { before, after };
  }

  async remove(id: string): Promise<CalloutDto> {
    const callout = await this.get(id);
    await this.prisma.callout.delete({ where: { id } });
    return callout;
  }

  private check({ status, pinned, audience }: { status: string; pinned: boolean; audience: CalloutAudience[] }) {
    if (pinned && status !== 'PUBLISHED') throw new BadRequestException('Only a published callout can be pinned');
    if (status === 'PUBLISHED' && audience.length === 0) {
      throw new BadRequestException('Choose who sees it before publishing');
    }
  }

  /** Writes the callout; when it takes the pin, any other pinned one lets go of it in the same transaction. */
  private async pinSafely(takesPin: boolean, id: string | null, write: (tx: Prisma.TransactionClient) => Promise<FullRow>) {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (takesPin) {
          await tx.callout.updateMany({
            where: { pinned: true, ...(id && { id: { not: id } }) },
            data: { pinned: false },
          });
        }
        return write(tx);
      });
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
