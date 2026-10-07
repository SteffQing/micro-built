import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { Box, EmailLayout, PrimaryButton, boxTextLast, h1, text } from './shared';

interface SupportHandoffEmailProps {
  name?: string;
  /** Who asked: a user's name and role, or "A visitor". */
  requester: string;
  title: string;
  note?: string;
  url: string;
}

/** A conversation was passed to the team: for the responders (CHAT_SUPPORT.md §1.7). */
export const SupportHandoffEmail = ({ name, requester, title, note, url }: SupportHandoffEmailProps) => (
  <EmailLayout preview={`${requester} needs help: ${title}`} footerNote="You receive these as a MicroBuilt Prime admin.">
    <Heading style={h1}>A conversation is waiting for the team</Heading>
    <Text style={text}>Hi {name || 'there'},</Text>
    <Text style={text}>
      {requester} passed “{title}” from the support chat to the team. Claim it in the Support inbox to reply.
    </Text>
    {note && (
      <Box tone="neutral">
        <Text style={{ ...boxTextLast, whiteSpace: 'pre-wrap' }}>{note}</Text>
      </Box>
    )}
    <PrimaryButton href={url}>Open the conversation</PrimaryButton>
  </EmailLayout>
);

export default SupportHandoffEmail;
