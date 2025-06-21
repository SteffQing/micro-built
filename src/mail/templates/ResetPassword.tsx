import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface Props {
  resetUrl: string;
  userName?: string;
}

export default function PasswordResetEmail({
  resetUrl,
  userName = 'there',
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Reset your MicroBuilt password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src="https://app.koopaa.fun/logo.png"
              width="150"
              height="50"
              alt="MicroBuilt"
              style={logo}
            />
          </Section>

          <Heading style={h1}>Reset your password</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            We received a request to reset the password for your MicroBuilt
            account.
          </Text>

          <Text style={text}>
            Click the button below to reset your password. This link will expire
            in 1 hour for security reasons.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>

          <Text style={text}>
            If the button doesn't work, you can also copy and paste this link
            into your browser:
          </Text>

          <Text style={linkText}>
            <Link href={resetUrl} style={link}>
              {resetUrl}
            </Link>
          </Text>

          <Text style={text}>
            If you didn't request a password reset, you can safely ignore this
            email. Your password will remain unchanged.
          </Text>

          <Text style={footer}>
            Best regards,
            <br />
            The MicroBuilt Team
          </Text>

          <Text style={footerText}>
            This email was sent from MicroBuilt. If you have any questions,
            please contact our support team.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

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

const logoContainer = {
  textAlign: 'center' as const,
  margin: '0 0 40px',
};

const logo = {
  margin: '0 auto',
};

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

const linkText = {
  fontSize: '14px',
  color: '#666',
  lineHeight: '24px',
  margin: '16px 0',
  wordBreak: 'break-all' as const,
};

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
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
