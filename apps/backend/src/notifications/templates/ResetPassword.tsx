import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, PrimaryButton, SecondaryLink, Signoff, h1, small, text } from './shared';

interface Props {
  resetUrl: string;
  userName?: string;
}

export default function PasswordResetEmail({
  resetUrl,
  userName = 'there',
}: Props) {
  return (
    <EmailLayout
      preview="Reset your MicroBuilt password"
      footerNote="This email was sent from MicroBuilt. If you have any questions, please contact our support team."
    >
      <Heading style={h1}>Reset your password</Heading>

      <Text style={text}>Hi {userName},</Text>

      <Text style={text}>
        We received a request to reset the password for your MicroBuilt account.
      </Text>

      <Text style={text}>
        Click the button below to reset your password. This link will expire in
        1 hour for security reasons.
      </Text>

      <PrimaryButton href={resetUrl}>Reset Password</PrimaryButton>

      <Text style={text}>
        If the button doesn't work, you can also copy and paste this link into
        your browser:
      </Text>

      <Text style={{ ...small, wordBreak: 'break-all' }}>
        <SecondaryLink href={resetUrl}>{resetUrl}</SecondaryLink>
      </Text>

      <Text style={text}>
        If you didn't request a password reset, you can safely ignore this
        email. Your password will remain unchanged.
      </Text>

      <Signoff />
    </EmailLayout>
  );
}
