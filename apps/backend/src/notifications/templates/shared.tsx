import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

/**
 * The single source of truth for how a MicroBuilt Prime email looks. Templates import tokens and components from
 * here and never define their own colours, fonts or button styles, so every real email looks the same and a phish
 * stands out.
 *
 * Gmail and Outlook ignore `padding` on <table>, and react-email's Section and Container render tables. So padding
 * never goes on a Section or Container: it lives on the <td> of a Column, which Box, Page and EmailLayout set up.
 *
 * Spacing scale: 8 / 12 / 16 / 24 / 32 px.
 */

export const space = { xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px' } as const;

export const brand = {
  primary: '#8a0806',
  primaryDark: '#6e0605',
  tint: '#fff0f0',
  tintBorder: '#f5c2c0',
  ink: '#18181b',
  body: '#3f3f46',
  muted: '#71717a',
  border: '#e4e4e7',
  page: '#f4f4f5',
  card: '#ffffff',
  neutralBg: '#fafafa',
} as const;

export const logoUrl = 'https://microbuiltprime.com/logo.png';
export const supportUrl = 'https://microbuiltprime.com/support';

export const fontStack = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
export const monoStack = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

export const main = {
  backgroundColor: brand.page,
  fontFamily: fontStack,
  margin: 0,
  padding: 0,
};

/** The card: a table that centres and caps the width. Its padding is on <td>s, not here. */
export const container = {
  margin: '24px auto',
  maxWidth: '560px',
  backgroundColor: brand.card,
  border: `1px solid ${brand.border}`,
  borderRadius: '12px',
};

export const pagePadding = '32px 24px';

export const h1 = {
  color: brand.ink,
  fontSize: '22px',
  lineHeight: '30px',
  fontWeight: 700,
  margin: '0 0 16px',
  padding: '0',
  textAlign: 'left' as const,
};

export const text = {
  color: brand.body,
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

export const small = {
  color: brand.muted,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 16px',
};

/** A bullet line in a short list. */
export const listItem = {
  ...text,
  margin: '0 0 8px',
  paddingLeft: '8px',
};

/** Inside a Box: colour is inherited from the Box so each tone sets its own text colour. */
export const boxTitle = {
  fontSize: '15px',
  lineHeight: '24px',
  fontWeight: 600,
  margin: '0 0 8px',
};

export const boxText = {
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 8px',
};

export const boxTextLast = { ...boxText, margin: '0' };

export const divider = {
  borderColor: brand.border,
  margin: '24px 0',
};

export const buttonStyle = {
  backgroundColor: brand.primary,
  borderRadius: '8px',
  color: '#ffffff',
  fontFamily: fontStack,
  fontSize: '15px',
  fontWeight: 600,
  lineHeight: '24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  margin: '0',
};

export const linkStyle = {
  color: brand.primary,
  textDecoration: 'underline',
};

/** A monospace value on a pill (credentials, ids). Long values wrap instead of overflowing. */
export const valuePill = {
  color: brand.ink,
  fontSize: '15px',
  lineHeight: '22px',
  fontWeight: 600,
  fontFamily: monoStack,
  backgroundColor: brand.card,
  border: `1px solid ${brand.border}`,
  borderRadius: '8px',
  padding: '8px 12px',
  margin: '0',
  wordBreak: 'break-all' as const,
};

export const credentialLabel = {
  color: brand.muted,
  fontSize: '13px',
  lineHeight: '20px',
  fontWeight: 600,
  margin: '0 0 8px',
};

export type BoxTone = 'neutral' | 'brand' | 'warning' | 'success' | 'danger' | 'plain';

const tones: Record<BoxTone, { backgroundColor?: string; border?: string; color: string }> = {
  neutral: { backgroundColor: brand.neutralBg, border: `1px solid ${brand.border}`, color: brand.body },
  brand: { backgroundColor: brand.tint, border: `1px solid ${brand.tintBorder}`, color: brand.body },
  warning: { backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' },
  success: { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' },
  danger: { backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
  // No box: just padding (a content band).
  plain: { color: brand.body },
};

interface BoxProps {
  tone?: BoxTone;
  /** Padding of the cell, e.g. '20px 24px'. */
  padding?: string;
  /** Overrides for the outer table (margin, borderTop, ...). */
  style?: React.CSSProperties;
  /** Overrides for the padded cell (textAlign, ...). */
  cellStyle?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * A padded, optionally tinted and bordered block. Padding sits on the <td> so Gmail and Outlook honour it.
 * Inside, set margins on Text explicitly: marginTop 0 on the first child, marginBottom 0 on the last.
 */
export function Box({ tone = 'neutral', padding = '20px 24px', style, cellStyle, children }: BoxProps) {
  const { backgroundColor, border, color } = tones[tone];
  const boxed = tone !== 'plain';
  return (
    <Section
      style={{
        backgroundColor,
        border,
        borderRadius: boxed ? '8px' : undefined,
        margin: boxed ? '24px 0' : '0',
        ...style,
      }}
    >
      <Row>
        <Column style={{ padding, color, ...cellStyle }}>{children}</Column>
      </Row>
    </Section>
  );
}

interface PageProps {
  /** Padding of the content cell. Default keeps text off the screen edge on mobile. */
  padding?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** The centred, width-capped container with its padding on a <td>. */
export function Page({ padding = pagePadding, style, children }: PageProps) {
  return (
    <Container style={{ ...container, ...style }}>
      <Section>
        <Row>
          <Column style={{ padding }}>{children}</Column>
        </Row>
      </Section>
    </Container>
  );
}

interface EmailLayoutProps {
  /** Inbox preview text. */
  preview: string;
  /** Template-specific footer line, e.g. "This invitation was sent to ada@example.com". */
  footerNote?: React.ReactNode;
  children: React.ReactNode;
}

const footerText = {
  color: brand.muted,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 8px',
  textAlign: 'center' as const,
};

/** The shell every email uses: logo header, padded body, footer with the anti-phishing line. */
export function EmailLayout({ preview, footerNote, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Row>
              <Column style={{ padding: space.lg, borderBottom: `1px solid ${brand.border}`, textAlign: 'left' }}>
                <Img
                  src={logoUrl}
                  width={140}
                  height={41}
                  alt="MicroBuilt Prime"
                  style={{ display: 'block', border: '0' }}
                />
              </Column>
            </Row>
          </Section>

          <Section>
            <Row>
              <Column style={{ padding: pagePadding }}>{children}</Column>
            </Row>
          </Section>

          <Section
            style={{
              backgroundColor: brand.neutralBg,
              borderTop: `1px solid ${brand.border}`,
              borderRadius: '0 0 12px 12px',
            }}
          >
            <Row>
              <Column style={{ padding: space.lg, textAlign: 'center' }}>
                <Text style={{ ...footerText, fontWeight: 600 }}>MicroBuilt Prime</Text>
                <Text style={footerText}>
                  We will never ask for your password, PIN or OTP by email, phone or SMS. If something looks off,{' '}
                  <Link href={supportUrl} style={linkStyle}>
                    contact support
                  </Link>
                  .
                </Text>
                {footerNote && <Text style={{ ...footerText, margin: '0' }}>{footerNote}</Text>}
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** The call to action. Every CTA in every email uses this. */
export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ textAlign: 'center', margin: '24px 0' }}>
      <Button href={href} style={buttonStyle}>
        {children}
      </Button>
    </Section>
  );
}

/** A quieter inline link: brand red, underlined. */
export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={linkStyle}>
      {children}
    </Link>
  );
}

/** A one-time code, big and monospaced on a brand tint. */
export function CodeBlock({ code }: { code: string }) {
  return (
    <Box tone="brand" padding="24px" cellStyle={{ textAlign: 'center' }}>
      <Text
        style={{
          color: brand.ink,
          fontFamily: monoStack,
          fontSize: '28px',
          lineHeight: '36px',
          fontWeight: 700,
          letterSpacing: '6px',
          margin: 0,
        }}
      >
        {code}
      </Text>
    </Box>
  );
}

/** A label and its monospace value pill, for credentials. Put inside a neutral Box. */
export function CredentialRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <Section style={{ margin: last ? '0' : '0 0 12px' }}>
      <Text style={credentialLabel}>{label}</Text>
      <Text style={valuePill}>{value}</Text>
    </Section>
  );
}

/** The standard sign-off. */
export function Signoff() {
  return (
    <Text style={{ ...text, margin: '24px 0 0' }}>
      Best regards,
      <br />
      The MicroBuilt Prime team
    </Text>
  );
}
