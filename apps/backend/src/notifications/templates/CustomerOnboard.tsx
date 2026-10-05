import { Heading, Hr, Text } from '@react-email/components';
import * as React from 'react';
import {
  Box,
  CredentialRow,
  EmailLayout,
  PrimaryButton,
  Signoff,
  boxText,
  boxTextLast,
  boxTitle,
  divider,
  h1,
  listItem,
  text,
} from './shared';

interface CustomerOnboardEmailProps {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export const CustomerOnboardEmail = ({
  name,
  email,
  phone,
  password,
}: CustomerOnboardEmailProps) => {
  return (
    <EmailLayout
      preview="Welcome to MicroBuilt — Your customer account is ready"
      footerNote={`This invitation was sent to ${email}. If you believe you received this email in error, please contact our support team immediately.`}
    >
      <Heading style={h1}>Welcome to MicroBuilt</Heading>

      <Text style={text}>Hi {name},</Text>

      <Text style={text}>
        Congratulations! You've been successfully onboarded as a customer by one
        of our admins. Your account has been created and is ready to use.
      </Text>

      <Box tone="neutral" padding="24px">
        <Text style={boxTitle}>Your Login Credentials</Text>
        <CredentialRow label="Email:" value={email} />
        {phone && <CredentialRow label="Phone Number:" value={phone} />}
        <CredentialRow label="Temporary Password:" value={password} last />
      </Box>

      <PrimaryButton href="https://microbuiltprime.com/login">
        Go to Login
      </PrimaryButton>

      <Hr style={divider} />

      <Box tone="brand">
        <Text style={boxTitle}>Password Security Notice</Text>
        <Text style={boxText}>
          The temporary password provided above is secure and unique. We
          strongly recommend updating it once you log in for enhanced security.
        </Text>
        <Text style={boxTextLast}>
          To update your password: Navigate to{' '}
          <strong>Settings → Security → Change Password</strong> after logging
          in.
        </Text>
      </Box>

      <Text style={text}>
        <strong>Getting Started:</strong>
      </Text>
      <Text style={listItem}>
        • Log in using your email, phone number, or the credentials above
      </Text>
      <Text style={listItem}>• Complete your profile setup</Text>
      <Text style={listItem}>• Update your password for security</Text>
      <Text style={listItem}>
        • Explore MicroBuilt features like loans and payroll management
      </Text>

      <Text style={{ ...text, marginTop: '16px' }}>
        If you have any questions or need assistance getting started, please
        don't hesitate to reach out to the support team.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

export default CustomerOnboardEmail;
