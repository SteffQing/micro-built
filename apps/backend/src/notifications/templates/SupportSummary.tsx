import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Box, EmailLayout, PrimaryButton, Signoff, boxTextLast, h1, text } from './shared';

export interface SupportTranscriptLine {
  /** Who wrote it, as the reader knows them: "You", "Assistant", a staff member's first name. Absent for notes. */
  speaker?: string;
  body: string;
}

interface SupportSummaryEmailProps {
  name?: string;
  /** The conversation's title. */
  title: string;
  /** The conversation, oldest first. */
  transcript: SupportTranscriptLine[];
  /** Drafted by the assistant from the conversation: how it ended, and anything left to do. Absent when no model could. */
  note?: string;
  url: string;
  /** The requester's copy, or the staff member's. */
  audience: 'requester' | 'staff';
}

const speakerStyle = { margin: '0 0 2px', fontSize: '12px', fontWeight: 600, color: '#6b7280' };
const lineStyle = { margin: '0 0 14px', fontSize: '14px', lineHeight: '21px', whiteSpace: 'pre-wrap' as const };
const noteLineStyle = { margin: '0 0 14px', fontSize: '12px', color: '#6b7280', textAlign: 'center' as const };

/** A support conversation was closed: the conversation itself and a closing note, for the requester and the team. */
export const SupportSummaryEmail = ({ name, title, transcript, note, url, audience }: SupportSummaryEmailProps) => (
  <EmailLayout
    preview={note?.slice(0, 120) ?? `“${title}” is closed`}
    footerNote={
      audience === 'requester'
        ? 'You are receiving this email because you asked the MicroBuilt Prime team for help.'
        : 'You are receiving this email because you handled this support conversation.'
    }
  >
    <Heading style={h1}>Conversation closed</Heading>
    <Text style={text}>Hi {name || 'there'},</Text>
    <Text style={text}>The support conversation “{title}” is closed. Here it is, for your records.</Text>
    {note && (
      <Box tone="neutral">
        <Text style={{ ...boxTextLast, whiteSpace: 'pre-wrap' }}>
          <strong>In short: </strong>
          {note}
        </Text>
      </Box>
    )}
    <Section style={{ margin: '20px 0' }}>
      {transcript.map((line, i) =>
        line.speaker ? (
          <React.Fragment key={i}>
            <Text style={speakerStyle}>{line.speaker}</Text>
            <Text style={lineStyle}>{line.body}</Text>
          </React.Fragment>
        ) : (
          <Text key={i} style={noteLineStyle}>
            {line.body}
          </Text>
        ),
      )}
    </Section>
    {audience === 'requester' && <Text style={text}>Need anything else? Start a new conversation any time.</Text>}
    <PrimaryButton href={url}>Open the conversation</PrimaryButton>
    <Signoff />
  </EmailLayout>
);

export default SupportSummaryEmail;
