import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, PrimaryButton, Signoff, h1, text } from './shared';

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
    <EmailLayout
      preview={message}
      footerNote="You are receiving this email because of activity on your MicroBuilt account. If you believe you received this email in error, please contact our support team."
    >
      <Heading style={h1}>{title}</Heading>

      <Text style={text}>Hi {name || 'there'},</Text>

      <Text style={text}>{message}</Text>

      {ctaUrl && (
        <PrimaryButton href={ctaUrl}>{ctaText || 'View Details'}</PrimaryButton>
      )}

      <Signoff />
    </EmailLayout>
  );
};

export default CustomerNotificationEmail;
