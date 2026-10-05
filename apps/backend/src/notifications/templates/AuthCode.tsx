import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { CodeBlock, EmailLayout, SecondaryLink, h1, small, supportUrl, text } from './shared';

interface Props {
  heading: string;
  /** One sentence on what the code is for. */
  intro: string;
  code: string;
  expiresInMinutes: number;
  userName?: string;
}

/** Every emailed one-time code: verification, sign-in, password reset, email change, 2FA. */
export default function AuthCodeEmail({ heading, intro, code, expiresInMinutes, userName = 'there' }: Props) {
  return (
    <EmailLayout
      preview={`${heading}: ${code}`}
      footerNote="This is an automated message, please do not reply."
    >
      <Heading style={h1}>{heading}</Heading>
      <Text style={text}>Hi {userName},</Text>
      <Text style={text}>{intro}</Text>

      <CodeBlock code={code} />

      <Text style={{ ...small, textAlign: 'center' }}>
        This code expires in {expiresInMinutes} minutes. Never share it.
      </Text>

      <Text style={{ ...small, margin: '24px 0 0' }}>
        If you did not ask for this code, ignore this message or{' '}
        <SecondaryLink href={supportUrl}>contact support</SecondaryLink>.
      </Text>
    </EmailLayout>
  );
}
