import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface CustomerImportEmailProps {
  name?: string;
  /** Rows with an IPPIS number. */
  total: number;
  imported: number;
  failed: number;
  /** Rows without an IPPIS number. */
  skipped: number;
  /** The first row errors, "Row 12 (Jane Doe): …". */
  errors: string[];
  /** Row errors beyond those listed. */
  moreErrors: number;
}

export const CustomerImportEmail = ({
  name,
  total,
  imported,
  failed,
  skipped,
  errors,
  moreErrors,
}: CustomerImportEmailProps) => {
  const outcome =
    total === 0
      ? 'The sheet had no rows with an IPPIS number, so nobody was imported.'
      : `${imported} of ${total} customers were imported; ${failed} failed.`;
  return (
    <Html>
      <Head />
      <Preview>{outcome}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {failed ? 'Customer import finished with errors' : 'Customer import complete'}
          </Heading>

          <Text style={text}>Hi {name || 'there'},</Text>

          <Text style={text}>
            The existing-customer sheet you uploaded has been processed. {outcome}
            {skipped > 0 &&
              ` ${skipped} row${skipped === 1 ? '' : 's'} without an IPPIS number ${skipped === 1 ? 'was' : 'were'} skipped.`}
          </Text>

          {errors.length > 0 && (
            <Section style={errorBox}>
              <Text style={errorTitle}>Rows not imported</Text>
              {errors.map((error, index) => (
                <Text key={index} style={errorLine}>
                  {error}
                </Text>
              ))}
              {moreErrors > 0 && (
                <Text style={errorLine}>…and {moreErrors} more.</Text>
              )}
            </Section>
          )}

          {failed > 0 && (
            <Text style={text}>
              Fix these rows and upload a sheet with only them: customers
              already imported would be reported as already registered.
            </Text>
          )}

          <Text style={text}>
            Imported customers sign in with a code sent to their phone number.
          </Text>

          <Text style={footer}>
            Best regards,
            <br />
            The MicroBuilt Team
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default CustomerImportEmail;

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

const errorBox = {
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
};

const errorTitle = {
  color: '#9a3412',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const errorLine = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '4px 0',
};

const footer = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '32px 0 16px',
};
