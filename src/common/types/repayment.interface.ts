// export interface RepaymentEntry {
//   staffId: string;
//   legacyId: string;
//   fullName: string;
//   grade: string;
//   step: number;
//   command: string;
//   element: string;
//   amount: number;
//   employeeGross: number;
//   netPay: number;
//   period: string;
// }
export interface RepaymentEntry {
  externalId: string;
  payroll: {
    grade: string;
    step: number;
    command: string;
    employeeGross: number;
    netPay: number;
  };
  repayment: { amount: number; period: string };
}
