import {
  Body,
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
  code: string;
  userName?: string;
}

export default function VerificationEmail({ code, userName = 'there' }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your MicroBuilt verification code: {code}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.headerText}>MICROBUILT</Text>
          </Section>

          <Section style={styles.content}>
            <Heading style={styles.heading}>Email Verification</Heading>
            <Text style={styles.paragraph}>Hi {userName},</Text>
            <Text style={styles.paragraph}>
              Welcome to MicroBuilt. Use the code below to verify your email and
              complete your account setup.
            </Text>

            <Section style={styles.codeContainer}>
              <Text style={styles.code}>{code}</Text>
            </Section>

            <Text style={styles.expiry}>
              This code will expire in 10 minutes.
            </Text>

            <Text style={styles.warning}>
              If you did not request this, feel free to ignore this message or{' '}
              <Link
                style={styles.link}
                href="https://microbuiltprime.com/support"
              >
                contact support
              </Link>
              .
            </Text>
          </Section>

          <Section style={styles.footer}>
            <Img
              src="https://microbuiltprime.com/logo.png"
              alt="MicroBuilt Logo"
              width={150}
              height={50}
              style={styles.logo}
            />
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} MicroBuilt. All rights reserved.
            </Text>
            <Text style={styles.footerText}>
              This is an automated message, please do not reply.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '20px 0',
    maxWidth: '600px',
  },
  header: {
    backgroundColor: '#0f172a',
    padding: '20px',
    textAlign: 'center' as const,
  },
  headerText: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 'bold',
    margin: 0,
  },
  content: {
    padding: '30px 20px',
  },
  heading: {
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 20px',
    textAlign: 'center' as const,
  },
  paragraph: {
    color: '#4a5568',
    fontSize: '16px',
    lineHeight: '24px',
    margin: '0 0 20px',
  },
  codeContainer: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    margin: '30px 0',
    padding: '20px',
    textAlign: 'center' as const,
  },
  code: {
    color: '#0f172a',
    fontFamily: 'monospace',
    fontSize: '36px',
    fontWeight: 'bold',
    letterSpacing: '8px',
    margin: 0,
  },
  expiry: {
    color: '#718096',
    fontSize: '14px',
    margin: '0 0 20px',
    textAlign: 'center' as const,
  },
  warning: {
    color: '#718096',
    fontSize: '14px',
    fontStyle: 'italic',
    margin: '30px 0 0',
  },
  link: {
    color: '#3182ce',
    textDecoration: 'underline',
  },
  footer: {
    borderTop: '1px solid #e2e8f0',
    padding: '20px',
    textAlign: 'center' as const,
  },
  logo: {
    margin: '0 auto 20px',
  },
  footerText: {
    color: '#a0aec0',
    fontSize: '12px',
    margin: '5px 0',
  },
};
