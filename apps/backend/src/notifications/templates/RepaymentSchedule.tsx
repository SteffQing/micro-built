import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, h1, text } from './shared';

interface RepaymentScheduleEmailProps {
  month: string;
  totalCustomers?: number;
  totalAmount?: string;
  variationId?: string;
  draft?: boolean;
}

export const RepaymentScheduleEmail = ({
  month,
  totalCustomers,
  totalAmount,
  variationId,
  draft,
}: RepaymentScheduleEmailProps) => {
  const title = `${draft ? 'DRAFT' : 'Prepared'} Payroll Variation – ${month}`;
  return (
    <EmailLayout
      preview={title}
      footerNote="This is an automated message, please do not reply."
    >
      <Heading style={h1}>{title}</Heading>
      <Text style={text}>Hi,</Text>
      <Text style={text}>
        Attached are the changed payroll deductions for {month}. Unchanged
        customers are omitted.
      </Text>

      {totalCustomers !== undefined && totalAmount !== undefined && (
        <Text style={text}>
          <strong>Details:</strong>
          <br />- Schedule Period: {month}
          <br />- Total Customers: {totalCustomers}
          <br />- Deductions in this variation: {totalAmount}
        </Text>
      )}

      <Text style={text}>
        {variationId ? `Variation ${variationId}. ` : ''}
        {draft
          ? 'This draft is for review only: do not send it to payroll. When it is right, submit the variation in MicroBuilt and send payroll the file it saves.'
          : `This is the variation submitted in MicroBuilt for ${month}: send it to payroll as it is.`}
      </Text>

      <Text style={{ ...text, marginBottom: 0 }}>
        Best regards,
        <br />
        MicroBuilt Loan Operations
      </Text>
    </EmailLayout>
  );
};
