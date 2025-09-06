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
  totalCustomers: number;
  totalAmount: string;
}

export const RepaymentScheduleEmail = ({
  month,
  totalCustomers,
  totalAmount,
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
              Repayment Schedule – {month}
            </Text>
            <Text>Hi,</Text>
            <Text>
              Please find attached the repayment schedule for MicroBuilt loans
              as of {month}.
            </Text>

            <Text>
              <strong>Details:</strong>
              <br />- Schedule Period: {month}
              <br />- Total Customers: {totalCustomers}
              <br />- Total Repayment Due: ₦{totalAmount}
            </Text>

            <Text>
              The attached file contains the full breakdown by customer.
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
