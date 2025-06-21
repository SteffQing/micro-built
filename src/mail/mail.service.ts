// src/mail/mail.service.ts

import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { render, pretty } from '@react-email/render';
import VerificationEmail from './templates/UserSignupVerificationEmail';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendUserSignupVerificationEmail(
    to: string,
    code: string,
    userName?: string,
  ) {
    const text = await pretty(
      await render(VerificationEmail({ code, userName })),
    );
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt <noreply@microbuilt.app>',
      to,
      subject: 'Verify your MicroBuilt account',
      react: VerificationEmail({ code, userName }),
      text,
    });

    if (error) {
      console.error('❌ Error sending verification email:', error);
      throw new Error('Failed to send email');
    }

    console.log('✅ Verification email sent to', to);
  }
}
