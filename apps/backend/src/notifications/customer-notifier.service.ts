import { Injectable, Logger } from '@nestjs/common';
import { visibleEmail } from '@microbuilt/shared';
import { PrismaService } from 'src/database/prisma.service';
import { InappService } from './inapp.service';
import { MailService } from './mail.service';
import { SmsService } from './sms.service';

/** Customer pages a notification opens. */
export const CUSTOMER_LINKS = {
  dashboard: '/dashboard',
  loans: '/loan-request',
  repayments: '/repayments',
} as const;

export interface CustomerNotification {
  title: string;
  message: string;
  ctaUrl?: string;
  ctaText?: string;
}

/**
 * Fans a customer-facing notification out to every available channel:
 * in-app always; email when the user has a real one, otherwise SMS when a
 * phone number exists. Never throws — notification delivery must not break
 * the financial flow that triggered it.
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

    let user: { name: string; email: string | null; phoneNumber: string | null };
    try {
      const found = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, phoneNumber: true },
      });
      if (!found) {
        this.logger.warn(`notify: no user found for id ${userId}`);
        return;
      }
      // Phone-only customers carry a placeholder address that must never be mailed.
      user = { ...found, email: visibleEmail(found.email) };
    } catch (error) {
      this.logger.error(`notify: failed to load user ${userId}`, error);
      return;
    }

    try {
      await this.inapp.messageUser({ userId, title, message, callToActionUrl: dto.ctaUrl });
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
      } else if (user.phoneNumber) {
        await this.sms.send(user.phoneNumber, `${title}: ${message}`);
      }
    } catch (error) {
      this.logger.error(
        `notify: ${user.email ? 'email' : 'sms'} delivery failed for ${userId}`,
        error,
      );
    }
  }
}
