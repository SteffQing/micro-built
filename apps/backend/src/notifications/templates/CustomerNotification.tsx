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
} from '@react-email/components';
import * as React from 'react';

interface CustomerNotificationEmailProps {
  name?: string;
  title: string;
  message: string;
  ctaUrl?: string;
  ctaText?: string;
}

export const CustomerNotificationEmail = ({
  name,
  title,
  message,
  ctaUrl,
  ctaText,
}: CustomerNotificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{message}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>

          <Text style={text}>Hi {name || 'there'},</Text>

          <Text style={text}>{message}</Text>

          {ctaUrl && (
            <Section style={buttonContainer}>
              <Button style={button} href={ctaUrl}>
                {ctaText || 'View Details'}
              </Button>
            </Section>
          )}

          <Text style={footer}>
            Best regards,
            <br />
            The MicroBuilt Team
          </Text>

          <Text style={footerText}>
            You are receiving this email because of activity on your MicroBuilt
            account. If you believe you received this email in error, please
            contact our support team.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default CustomerNotificationEmail;

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
