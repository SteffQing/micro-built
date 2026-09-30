import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { InappService } from './inapp.service';
import { MailService } from './mail.service';
import { SmsService } from './sms.service';

export interface CustomerNotification {
  title: string;
  message: string;
  ctaUrl?: string;
  ctaText?: string;
}

/**
 * Fans a customer-facing notification out to every available channel:
 * in-app always; email when the user has one, otherwise SMS when a phone
 * number exists. Never throws — notification delivery must not break the
 * financial flow that triggered it.
 */
@Injectable()
export class CustomerNotifierService {
  private readonly logger = new Logger(CustomerNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inapp: InappService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  async notify(userId: string, dto: CustomerNotification) {
    const { title, message } = dto;

    let user: { name: string; email: string | null; contact: string | null };
    try {
      const found = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, contact: true },
      });
      if (!found) {
        this.logger.warn(`notify: no user found for id ${userId}`);
        return;
      }
      user = found;
    } catch (error) {
      this.logger.error(`notify: failed to load user ${userId}`, error);
      return;
    }

    try {
      await this.inapp.messageUser({ userId, title, message });
    } catch (error) {
      this.logger.error(
        `notify: in-app notification failed for ${userId}`,
        error,
      );
    }

    try {
      if (user.email) {
        await this.mail.sendCustomerNotification(user.email, {
          name: user.name,
          ...dto,
        });
      } else if (user.contact) {
        await this.sms.send(user.contact, `${title}: ${message}`);
      }
    } catch (error) {
      this.logger.error(
        `notify: ${user.email ? 'email' : 'sms'} delivery failed for ${userId}`,
        error,
      );
    }
  }
}
