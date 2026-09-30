import { UserRole } from '@prisma/client';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface AdminInviteEmailProps {
  name: string;
  email: string;
  password: string;
  adminId: string;
  role: UserRole;
}

export const AdminInviteEmail = ({
  name,
  email,
  password,
  adminId,
  role,
}: AdminInviteEmailProps) => {
  const roleLabel =
    role === 'SUPER_ADMIN'
      ? 'Super Admin'
      : role === 'MARKETER'
        ? 'Marketer'
        : 'Admin';
  return (
    <Html>
      <Head />
      <Preview>
        Welcome to MicroBuilt {roleLabel} — Your account is ready
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to MicroBuilt</Heading>

          <Text style={text}>Hi {name},</Text>

          <Text style={text}>
            Congratulations! You've been invited to join MicroBuilt as a
            <strong> {roleLabel}</strong>. Your account has been created and is
            ready to use.
          </Text>

          <Section style={credentialsContainer}>
            <Text style={credentialsTitle}>Your Login Credentials</Text>

            <Section style={credentialRow}>
              <Text style={credentialLabel}>{role} ID:</Text>
              <Text style={credentialValue}>{adminId}</Text>
            </Section>

            <Section style={credentialRow}>
              <Text style={credentialLabel}>Email:</Text>
              <Text style={credentialValue}>{email}</Text>
            </Section>

            <Section style={credentialRow}>
              <Text style={credentialLabel}>Temporary Password:</Text>
              <Text style={credentialValue}>{password}</Text>
            </Section>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={'https://microbuiltprime.com/login'}>
              Go to Dashboard
            </Button>
          </Section>

          <Hr style={divider} />

          <Section style={securitySection}>
            <Text style={securityTitle}>🔒 Password Security Notice</Text>
            <Text style={securityText}>
              The temporary password provided above is secure and unique. We
              strongly recommend updating it once you log in to your dashboard
              for enhanced security.
            </Text>
            <Text style={securityText}>
              To update your password: Navigate to{' '}
              <strong>Settings → Security → Change Password</strong> after
              logging in.
            </Text>
          </Section>

          <Hr style={divider} />

          <Text style={text}>
            <strong>Getting Started:</strong>
          </Text>
          <Text style={listItem}>• Log in using the credentials above</Text>
          <Text style={listItem}>• Complete your profile setup</Text>
          <Text style={listItem}>• Update your password for security</Text>
          <Text style={listItem}>• Explore the admin dashboard features</Text>

          <Text style={text}>
            If you have any questions or need assistance getting started, please
            don't hesitate to reach out to the support team.
          </Text>

          <Text style={footer}>
            Best regards,
            <br />
            The MicroBuilt Team
          </Text>

          <Text style={footerText}>
            This invitation was sent to {email}. If you believe you received
            this email in error, please contact our support team immediately.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default AdminInviteEmail;

// Styles
const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
};

// Removed unused logoContainer and logo styles

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const credentialsContainer = {
  backgroundColor: '#f8f9fa',
  border: '1px solid #e9ecef',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const credentialsTitle = {
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
  textAlign: 'center' as const,
};

const credentialRow = {
  margin: '12px 0',
};

const credentialLabel = {
  color: '#666',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 4px 0',
};

const credentialValue = {
  color: '#333',
  fontSize: '16px',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  backgroundColor: '#ffffff',
  border: '1px solid #dee2e6',
  borderRadius: '4px',
  padding: '8px 12px',
  margin: '0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  margin: '0',
};

const divider = {
  borderColor: '#e9ecef',
  margin: '32px 0',
};

const securitySection = {
  backgroundColor: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const securityTitle = {
  color: '#0c4a6e',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const securityText = {
  color: '#0c4a6e',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '8px 0',
};

const listItem = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '8px 0',
  paddingLeft: '8px',
};

const footer = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '32px 0 16px',
};

const footerText = {
  color: '#898989',
  fontSize: '12px',
  lineHeight: '22px',
  margin: '16px 0',
  textAlign: 'center' as const,
};
