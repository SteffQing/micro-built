import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Section,
} from '@react-email/components';
import * as React from 'react';

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
  return (
    <Html>
      <Head />
      <Body
        style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f9f9f9' }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            padding: '20px',
            borderRadius: '8px',
          }}
        >
          <Section>
            <Text style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {draft ? 'DRAFT' : 'Prepared'} Payroll Variation – {month}
            </Text>
            <Text>Hi,</Text>
            <Text>
              Attached are the changed payroll deductions for {month}. Unchanged
              customers are omitted.
            </Text>

            {totalCustomers !== undefined && totalAmount !== undefined && (
              <Text>
                <strong>Details:</strong>
                <br />- Schedule Period: {month}
                <br />- Total Customers: {totalCustomers}
                <br />- Deductions in this variation: {totalAmount}
              </Text>
            )}

            <Text>
              {variationId ? `Variation ${variationId}. ` : ''}
              {draft
                ? 'This draft is for review only: do not send it to payroll. When it is right, submit the variation in MicroBuilt and send payroll the file it saves.'
                : `This is the variation submitted in MicroBuilt for ${month}: send it to payroll as it is.`}
            </Text>

            <Text>
              Best regards,
              <br />
              MicroBuilt Loan Operations
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};
