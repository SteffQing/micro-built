// src/mail/mail.service.ts

import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { render, pretty } from '@react-email/render';
import VerificationEmail from './templates/UserSignupVerificationEmail';
import PasswordResetEmail from './templates/ResetPassword';

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
      from: 'MicroBuilt <onboarding@resend.dev>',
      to,
      subject: 'Verify your MicroBuilt account',
      react: VerificationEmail({ code, userName }),
      text,
    });

    if (error) {
      console.error('❌ Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(to: string, token: string, userName?: string) {
    const resetUrl = `/reset-password?token=${token}`;
    const text = await pretty(
      await render(PasswordResetEmail({ resetUrl, userName })),
    );
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt <onboarding@resend.dev>',
      to,
      subject: 'Reset your MicroBuilt account password',
      react: PasswordResetEmail({ resetUrl, userName }),
      text,
    });

    if (error) {
      console.error('❌ Error sending reset password email:', error);
      throw new Error('Failed to send reset password email');
    }
  }
}
