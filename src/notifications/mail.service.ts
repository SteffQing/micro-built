
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { render, pretty } from '@react-email/render';
import VerificationEmail from './templates/UserSignupVerificationEmail';
import PasswordResetEmail from './templates/ResetPassword';
import AdminInviteEmail from './templates/AdminInvite';

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
      from: 'MicroBuilt <welcome@microbuild.algomeme.fun>',
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
    const resetUrl = `https://micro-built.vercel.app/reset-password?token=${token}`;
    const text = await pretty(
      await render(PasswordResetEmail({ resetUrl, userName })),
    );
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt <reset@microbuild.algomeme.fun>',
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

  async sendAdminInvite(
    to: string,
    name: string,
    password: string,
    adminId: string,
  ) {
    const text = await pretty(
      await render(AdminInviteEmail({ email: to, name, password, adminId })),
    );
    const { error } = await this.resend.emails.send({
      from: 'MicroBuilt <invite@microbuild.algomeme.fun>',
      to,
      subject: `Welcome to MicroBuilt, ${name}`,
      react: AdminInviteEmail({ email: to, name, password, adminId }),
      text,
    });

    if (error) {
      console.error('❌ Error sending invite email:', error);
      throw new Error('Failed to send invite email');
    }
  }
}
