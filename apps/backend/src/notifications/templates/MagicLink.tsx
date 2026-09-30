import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface Props {
  url: string;
  expiresInMinutes: number;
}

export default function MagicLinkEmail({ url, expiresInMinutes }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your MicroBuilt sign-in link</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.headerText}>MICROBUILT</Text>
          </Section>

          <Section style={styles.content}>
            <Heading style={styles.heading}>Sign in to MicroBuilt</Heading>
            <Text style={styles.paragraph}>
              Use the button below to sign in. It works once and expires in {expiresInMinutes} minutes.
            </Text>
            <Section style={styles.buttonContainer}>
              <Button style={styles.button} href={url}>
                Sign in
              </Button>
            </Section>
            <Text style={styles.small}>If the button does not work, open this link:</Text>
            <Link href={url} style={styles.link}>
              {url}
            </Link>
            <Text style={styles.warning}>
              If you did not ask to sign in, ignore this message; nobody can use your account without this link.
            </Text>
          </Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>© {new Date().getFullYear()} MicroBuilt. All rights reserved.</Text>
            <Text style={styles.footerText}>This is an automated message, please do not reply.</Text>
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
  container: { backgroundColor: '#ffffff', margin: '0 auto', padding: '20px 0', maxWidth: '600px' },
  header: { backgroundColor: '#0f172a', padding: '20px', textAlign: 'center' as const },
  headerText: { color: '#ffffff', fontSize: '24px', fontWeight: 'bold', margin: 0 },
  content: { padding: '30px 20px' },
  heading: {
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 20px',
    textAlign: 'center' as const,
  },
  paragraph: { color: '#4a5568', fontSize: '16px', lineHeight: '24px', margin: '0 0 20px' },
  buttonContainer: { textAlign: 'center' as const, margin: '30px 0' },
  button: {
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 'bold',
    padding: '12px 28px',
    textDecoration: 'none',
  },
  small: { color: '#718096', fontSize: '14px', margin: '0 0 8px' },
  link: { color: '#3182ce', fontSize: '13px', wordBreak: 'break-all' as const },
  warning: { color: '#718096', fontSize: '14px', fontStyle: 'italic', margin: '30px 0 0' },
  footer: { borderTop: '1px solid #e2e8f0', padding: '20px', textAlign: 'center' as const },
  footerText: { color: '#a0aec0', fontSize: '12px', margin: '5px 0' },
};
