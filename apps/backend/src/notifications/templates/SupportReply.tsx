import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { Box, EmailLayout, PrimaryButton, Signoff, boxTextLast, h1, text } from './shared';

interface SupportReplyEmailProps {
  name?: string;
  /** The staff member's first name. */
  from?: string;
  /** The conversation's title. */
  title: string;
  reply: string;
  url: string;
}

/** The team answered a conversation passed to it from the support chat (CHAT_SUPPORT.md §1.7). */
export const SupportReplyEmail = ({ name, from, title, reply, url }: SupportReplyEmailProps) => (
  <EmailLayout
    preview={reply.slice(0, 120)}
    footerNote="You are receiving this email because you asked the MicroBuilt Prime team for help."
  >
    <Heading style={h1}>The team replied</Heading>
    <Text style={text}>Hi {name || 'there'},</Text>
    <Text style={text}>
      {from ? `${from} from the MicroBuilt Prime team` : 'The MicroBuilt Prime team'} replied to your conversation
      “{title}”:
    </Text>
    <Box tone="neutral">
      <Text style={{ ...boxTextLast, whiteSpace: 'pre-wrap' }}>{reply}</Text>
    </Box>
    <PrimaryButton href={url}>Open the conversation</PrimaryButton>
    <Signoff />
  </EmailLayout>
);

export default SupportReplyEmail;
