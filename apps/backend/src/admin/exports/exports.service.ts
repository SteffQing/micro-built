import { Injectable } from '@nestjs/common';
import { visibleEmail } from '@microbuilt/shared';
import { parsePeriodRange } from 'src/common/dto/period.dto';
import type { AuthUser } from 'src/common/types';
import type { ExportDataset } from 'src/common/types/report.interface';
import { QueueProducer } from 'src/queue/bull/queue.producer';

@Injectable()
export class ExportService {
  constructor(private readonly queue: QueueProducer) {}

  /**
   * Queues a list export (D11). `filters` is the list's query DTO, optionally with an `email`;
   * page/limit are dropped so the whole filtered list is exported. The file reaches the requester
   * in-app as a 7-day link, and by email at `email` or else the requester's own real address.
   * `scopeUserId` limits the export to one customer's own records (their side of the app).
   */
  async queueExport(
    dataset: ExportDataset,
    filters: Record<string, unknown> & { email?: string },
    requester: AuthUser,
    scopeUserId?: string,
  ): Promise<{ data: null; message: string }> {
    const { email, ...rest } = filters;
    delete rest.page;
    delete rest.limit;
    // Fail now rather than in the job: 400 when `from` is after `to`.
    parsePeriodRange({
      from: typeof rest.from === 'string' ? rest.from : undefined,
      to: typeof rest.to === 'string' ? rest.to : undefined,
    });

    const recipient = visibleEmail(email) ?? visibleEmail(requester.email) ?? undefined;
    await this.queue.exportList({
      dataset,
      filters: rest,
      requestedById: requester.userId,
      email: recipient,
      scopeUserId,
    });
    return {
      data: null,
      message: recipient
        ? `Your export is being generated. The download link will be sent to ${recipient} and to your notifications`
        : 'Your export is being generated. The download link will be sent to your notifications',
    };
  }
}
