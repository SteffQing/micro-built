import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Section,
} from '@react-email/components';
import * as React from 'react';

interface CustomerLoanReportEmailProps {
  customerName: string;
  customerId: string;
  startDate: string;
  endDate: string;
  loanCount: number;
}

export const CustomerLoanReportEmail = ({
  customerName,
  customerId,
  startDate,
  endDate,
  loanCount,
}: CustomerLoanReportEmailProps) => {
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
              Loan Report for {customerName}
            </Text>
            <Text>
              Attached is the loan report for {customerName} with MicroBuilt.
            </Text>

            <Text>
              <strong>Details:</strong>
              <br />- Customer Name: {customerName}
              <br />- IPPIS ID: {customerId}
              <br />- Report Period: {startDate} – {endDate}
              <br />- Loans Covered: {loanCount}
            </Text>

            <Text>
              The report provides:
              <br />- Loan disbursements and top-ups
              <br />- Repayment history
              <br />- Outstanding balances (if any)
            </Text>

            <Text>
              Please review the report. If you have any questions, kindly reach
              out to our support team.
            </Text>

            <Text>
              Best regards,
              <br />
              MicroBuilt Customer Support
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};
