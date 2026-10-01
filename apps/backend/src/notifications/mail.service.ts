import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { render, pretty } from '@react-email/render';
import {
  CODE_TTL_MINUTES,
  MAGIC_LINK_TTL_MINUTES,
  TWO_FACTOR_CODE_TTL_MINUTES,
} from 'src/auth/auth.constants';
import AuthCodeEmail from './templates/AuthCode';
import MagicLinkEmail from './templates/MagicLink';
import PasswordResetEmail from './templates/ResetPassword';
import AdminInviteEmail from './templates/AdminInvite';
import { formatCurrency } from 'src/common/utils';
import { RepaymentScheduleEmail } from './templates/RepaymentSchedule';
import { AdminRole } from '@prisma/client';
import type { ReactElement } from 'react';
import CustomerOnboardEmail from './templates/CustomerOnboard';
import CustomerNotificationEmail from './templates/CustomerNotification';
import CustomerImportEmail from './templates/CustomerImport';

export type EmailCodeType = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

// What each emailed code is for (better-auth's emailOTP types).
const CODE_COPY: Record<EmailCodeType, { subject: string; heading: string; intro: string }> = {
  'email-verification': {
    subject: 'Verify your email for MicroBuilt',
    heading: 'Verify your email',
    intro: 'Use this code to verify your email address and finish setting up your MicroBuilt account.',
  },
  'sign-in': {
    subject: 'Your MicroBuilt sign-in code',
    heading: 'Your sign-in code',
    intro: 'Use this code to sign in to MicroBuilt.',
  },
  'forget-password': {
    subject: 'Reset your MicroBuilt password',
    heading: 'Reset your password',
    intro: 'Use this code to choose a new password for your MicroBuilt account.',
  },
  'change-email': {
    subject: 'Confirm your new email for MicroBuilt',
    heading: 'Confirm your new email',
    intro: 'Use this code to make this address the email on your MicroBuilt account.',
  },
};

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  // Auth mail (better-auth's senders). Each throws on failure; better-auth runs them in the
  // background and logs the error, so a failed delivery never changes the auth response.

  async sendOtp(to: string, otp: string, type: EmailCodeType) {
    const copy = CODE_COPY[type];
    await this.sendAuthEmail(
      to,
      copy.subject,
      AuthCodeEmail({ heading: copy.heading, intro: copy.intro, code: otp, expiresInMinutes: CODE_TTL_MINUTES }),
    );
  }

  async sendTwoFactorCode(to: string, name: string, otp: string) {
    await this.sendAuthEmail(
      to,
      'Your MicroBuilt verification code',
      AuthCodeEmail({
        heading: 'Finish signing in',
        intro: 'Use this code to finish signing in to MicroBuilt.',
        code: otp,
        expiresInMinutes: TWO_FACTOR_CODE_TTL_MINUTES,
        userName: name,
      }),
    );
  }

  async sendMagicLink(to: string, url: string) {
    await this.sendAuthEmail(
      to,
      'Your MicroBuilt sign-in link',
      MagicLinkEmail({ url, expiresInMinutes: MAGIC_LINK_TTL_MINUTES }),
    );
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string) {
    await this.sendAuthEmail(
      to,
      'Reset your MicroBuilt password',
      PasswordResetEmail({ resetUrl, userName: name }),
    );
  }

  private async sendAuthEmail(to: string, subject: string, email: ReactElement) {
    const text = await pretty(await render(email));
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt Prime <auth@updates.microbuiltprime.com>',
      to,
      subject,
      react: email,
      text,
    });
    if (error) throw new Error(`Resend refused "${subject}": ${error.message}`);
  }

  async sendAdminInvite(
    to: string,
    name: string,
    password: string,
    adminId: string,
    role: AdminRole,
  ) {
    const text = await pretty(
      await render(
        AdminInviteEmail({ email: to, name, password, adminId, role }),
      ),
    );
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt Prime <invite@updates.microbuiltprime.com>',
      to,
      subject: `Welcome to MicroBuilt, ${name}`,
      react: AdminInviteEmail({ email: to, name, password, adminId, role }),
      text,
    });

    if (error) {
      console.error('❌ Error sending invite email:', error);
      throw new Error('Failed to send invite email');
    }
  }

  async sendLoanScheduleReport(
    to: string,
    data: {
      period: string;
      len?: number;
      amount?: number;
      variationId?: string;
      draft?: boolean;
    },
    file: Buffer,
  ) {
    const text = await pretty(
      await render(
        RepaymentScheduleEmail({
          month: data.period,
          variationId: data.variationId,
          draft: data.draft,
          totalCustomers: data.len,
          totalAmount: formatCurrency(data.amount),
        }),
      ),
    );
    const { data: result, error } = await this.resend.emails.send({
      from: 'MicroBuilt Prime <reports@updates.microbuiltprime.com>',
      to,
      subject: `${data.draft ? 'DRAFT' : 'Prepared'} Payroll Variation – ${data.period}`,
      react: RepaymentScheduleEmail({
        month: data.period,
        variationId: data.variationId,
        draft: data.draft,
        ...(data.len !== undefined && data.amount !== undefined
          ? {
              totalCustomers: data.len,
              totalAmount: formatCurrency(data.amount),
            }
          : {}),
      }),
      text,
      attachments: [
        {
          filename: `${data.period}_${data.variationId ?? 'LoanSchedule'}.xlsx`,
          content: file,
        },
      ],
    });

    if (error) {
      console.error('❌ Error sending loan schedule email:', error);
      throw new Error(`Failed to send loan schedule email: ${error.message}`);
    }

    return result;
  }

  async sendOnboardedCustomerInvite(
    to: string,
    name: string,
    password: string,
    phone?: string,
  ) {
    const text = await pretty(
      await render(CustomerOnboardEmail({ email: to, name, password, phone })),
    );
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt Prime <onboard@updates.microbuiltprime.com>',
      to,
      subject: `Welcome to MicroBuilt, ${name}`,
      react: CustomerOnboardEmail({ email: to, name, password, phone }),
      text,
    });

    if (error) {
      console.error('❌ Error sending onboard email:', error);
      throw new Error('Failed to send onboard email');
    }
  }

  async sendCustomerNotification(
    to: string,
    data: {
      name?: string;
      title: string;
      message: string;
      ctaUrl?: string;
      ctaText?: string;
    },
  ) {
    const text = await pretty(await render(CustomerNotificationEmail(data)));
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt Prime <notifications@updates.microbuiltprime.com>',
      to,
      subject: data.title,
      react: CustomerNotificationEmail(data),
      text,
    });

    if (error) {
      console.error('❌ Error sending customer notification email:', error);
      throw new Error('Failed to send customer notification email');
    }
  }

  /** What an existing-customer upload did, for the admin who uploaded it. */
  async sendCustomerImportSummary(
    to: string,
    data: {
      name?: string;
      total: number;
      imported: number;
      failed: number;
      skipped: number;
      /** The first row errors, "Row 12 (Jane Doe): …". */
      errors: string[];
      /** Row errors beyond those listed. */
      moreErrors: number;
    },
  ) {
    const email = CustomerImportEmail(data);
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt Prime <onboard@updates.microbuiltprime.com>',
      to,
      subject: data.failed
        ? `Customer import: ${data.imported} imported, ${data.failed} failed`
        : `Customer import: ${data.imported} imported`,
      react: email,
      text: await render(email, { plainText: true }),
    });

    if (error) {
      throw new Error(`Failed to send customer import summary: ${error.message}`);
    }
  }
}
