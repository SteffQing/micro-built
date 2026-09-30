import { BadRequestException, Injectable } from '@nestjs/common';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import { ExportDataset } from 'src/common/types/report.interface';

@Injectable()
export class ExportService {
  constructor(private readonly queue: QueueProducer) {}

  /**
   * Queues a background export. `dto` is any list-filter DTO (optionally with an
   * `email`); pagination fields are stripped so the worker exports the full
   * filtered set. `scopeUserId` restricts the export to one user (user-side).
   */
  queueExport(
    dataset: ExportDataset,
    dto: Record<string, any> & { email?: string },
    requesterEmail: string | undefined,
    scopeUserId?: string,
  ) {
    // page/limit are harmless to the worker's filter builders, so we only peel
    // off the recipient email; everything else is forwarded as the filter set.
    const { email, ...filters } = dto;
    const recipient = email || requesterEmail;

    if (!recipient) {
      throw new BadRequestException(
        'No recipient email available. Provide an "email" to receive the export.',
      );
    }

    return this.queue.exportList({
      dataset,
      filters,
      email: recipient,
      scopeUserId,
    });
  }
}
