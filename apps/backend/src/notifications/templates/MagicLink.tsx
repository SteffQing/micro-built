import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, PrimaryButton, SecondaryLink, h1, small, text } from './shared';

interface Props {
  url: string;
  expiresInMinutes: number;
}

export default function MagicLinkEmail({ url, expiresInMinutes }: Props) {
  return (
    <EmailLayout
      preview="Your MicroBuilt sign-in link"
      footerNote="This is an automated message, please do not reply."
    >
      <Heading style={h1}>Sign in to MicroBuilt</Heading>
      <Text style={text}>
        Use the button below to sign in. It works once and expires in {expiresInMinutes} minutes.
      </Text>

      <PrimaryButton href={url}>Sign in</PrimaryButton>

      <Text style={{ ...small, margin: '0 0 8px' }}>If the button does not work, open this link:</Text>
      <Text style={{ ...small, wordBreak: 'break-all' }}>
        <SecondaryLink href={url}>{url}</SecondaryLink>
      </Text>

      <Text style={{ ...small, margin: '24px 0 0' }}>
        If you did not ask to sign in, ignore this message; nobody can use your account without this link.
      </Text>
    </EmailLayout>
  );
}
