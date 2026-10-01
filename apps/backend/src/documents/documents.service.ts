import { Injectable, Logger } from '@nestjs/common';
import { visibleEmail } from '@microbuilt/shared';
import { captureJobError } from 'src/common/observability';
import { SupabaseService } from 'src/database/supabase.service';
import { InappService } from 'src/notifications/inapp.service';
import { MailService } from 'src/notifications/mail.service';

/** Private bucket for generated files (exports, statements, reports). */
export const EXPORTS_BUCKET = 'exports';
/** How long a download link works. */
export const DOWNLOAD_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface DeliverDocument {
  /** Who gets the in-app notification (and owns the file's folder). */
  userId: string;
  /** Also emailed here when it's a real address; a placeholder or none = in-app only. */
  email?: string | null;
  title: string;
  message: string;
  /** What the browser saves the file as. */
  fileName: string;
  contentType: string;
  body: Buffer;
}

export interface DeliveredDocument {
  path: string;
  url: string;
  emailed: boolean;
}

// D11: a generated file goes to the private `exports` bucket and reaches people as a 7-day signed
// link, in-app and (when there's a real address) by email. Nothing is attached to an email.
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly inapp: InappService,
    private readonly mail: MailService,
  ) {}

  async deliver(doc: DeliverDocument): Promise<DeliveredDocument> {
    const path = `${doc.userId}/${Date.now()}-${doc.fileName}`;
    await this.supabase.uploadPrivate(EXPORTS_BUCKET, path, doc.body, doc.contentType);
    const url = await this.supabase.signedUrl(EXPORTS_BUCKET, path, DOWNLOAD_LINK_TTL_SECONDS, doc.fileName);

    await this.inapp.messageUser({
      userId: doc.userId,
      title: doc.title,
      message: doc.message,
      callToActionUrl: url,
    });

    const to = visibleEmail(doc.email);
    if (!to) return { path, url, emailed: false };
    // The link is already in-app: a failed email is reported, not retried (a retry would make the
    // file and the notification again).
    try {
      await this.mail.sendCustomerNotification(to, {
        title: doc.title,
        message: doc.message,
        ctaUrl: url,
        ctaText: 'Download',
      });
      return { path, url, emailed: true };
    } catch (error) {
      this.logger.error(`Emailing ${path} failed`, error instanceof Error ? error.stack : String(error));
      captureJobError(error, { job: 'documents.deliver-email' });
      return { path, url, emailed: false };
    }
  }
}
