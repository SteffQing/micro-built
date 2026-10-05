import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import {
  Box,
  EmailLayout,
  Signoff,
  boxText,
  boxTextLast,
  boxTitle,
  h1,
  text,
} from './shared';

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
  /** Imported rows worth a second look, e.g. a cash loan booked with no interest. */
  warnings?: string[];
  moreWarnings?: number;
}

export const CustomerImportEmail = ({
  name,
  total,
  imported,
  failed,
  skipped,
  errors,
  moreErrors,
  warnings = [],
  moreWarnings = 0,
}: CustomerImportEmailProps) => {
  const outcome =
    total === 0
      ? 'The sheet had no rows with an IPPIS number, so nobody was imported.'
      : `${imported} of ${total} customers were imported; ${failed} failed.`;
  return (
    <EmailLayout
      preview={outcome}
      footerNote="This is an automated message, please do not reply."
    >
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
        <Box tone="warning" padding="16px 24px">
          <Text style={boxTitle}>Rows not imported</Text>
          {errors.map((error, index) => (
            <Text
              key={index}
              style={
                index === errors.length - 1 && moreErrors === 0
                  ? boxTextLast
                  : boxText
              }
            >
              {error}
            </Text>
          ))}
          {moreErrors > 0 && (
            <Text style={boxTextLast}>…and {moreErrors} more.</Text>
          )}
        </Box>
      )}

      {warnings.length > 0 && (
        <Box padding="16px 24px">
          <Text style={boxTitle}>Imported, but check these</Text>
          {warnings.map((warning, index) => (
            <Text
              key={index}
              style={
                index === warnings.length - 1 && moreWarnings === 0
                  ? boxTextLast
                  : boxText
              }
            >
              {warning}
            </Text>
          ))}
          {moreWarnings > 0 && (
            <Text style={boxTextLast}>…and {moreWarnings} more.</Text>
          )}
        </Box>
      )}

      {failed > 0 && (
        <Text style={text}>
          Fix these rows and upload a sheet with only them: customers already
          imported would be reported as already registered.
        </Text>
      )}

      <Text style={text}>
        Imported customers sign in with a code sent to their phone number.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

export default CustomerImportEmail;
