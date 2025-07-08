export type Loan = {
  id: string;
  amount: string;
  tenure: string;
  repaidAmount: string;
  balance: string;
  status: "Active" | "Completed" | "Defaulted";
  customerId: string;
  loanType: string;
  totalInterest: string;
  amountRemaining: string;
  nextPaymentDate: string;
  nextPaymentAmount: string;
  loanPurpose: string;
  disbursementDate: string;
  interestRate: string;
  monthlyRepayment: string;
  totalRepayment: string;
};

export type RepaymentHistory = {
  loanId: string;
  date: string;
  amountPaid: string;
  paymentMethod: "Payroll" | "Bank Transfer" | "Card Payment" | "Cash";
  status: "Success" | "Pending" | "Failed";
};

export type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  isVerified: boolean;
  status: "Active" | "Inactive" | "Suspended";
  totalLoans: string;
  activeLoansCount: number;
  outstandingBalance: string;
  repaymentRate: string;
};

export const customerProfile: CustomerProfile = {
  id: "CUS0045",
  name: "Jadesola Stephanie Cole",
  email: "jadecole@gmail.com",
  phone: "+234 8134568058",
  avatar: "/woman.jpeg",
  isVerified: true,
  status: "Active",
  totalLoans: "₦5,000,000",
  activeLoansCount: 12,
  outstandingBalance: "₦220,000",
  repaymentRate: "92%",
};

export const activeLoans: Loan[] = [
  {
    id: "LN-2200",
    customerId: "CUS0045",
    loanType: "Payday Loan",
    amount: "₦500,000",
    tenure: "40/60 Days",
    repaidAmount: "₦250,000",
    balance: "₦250,000",
    totalInterest: "₦50,000",
    amountRemaining: "₦250,000",
    nextPaymentDate: "15 Jun 2023",
    nextPaymentAmount: "₦25,000",
    loanPurpose: "Business Expansion",
    disbursementDate: "15 Apr 2023",
    interestRate: "10%",
    monthlyRepayment: "₦25,000",
    totalRepayment: "₦550,000",
    status: "Active",
  },
  {
    id: "LN-2199",
    customerId: "CUS0045",
    loanType: "Personal Loan",
    amount: "₦750,000",
    tenure: "12 Months",
    repaidAmount: "₦250,000",
    balance: "₦500,000",
    totalInterest: "₦75,000",
    amountRemaining: "₦500,000",
    nextPaymentDate: "20 Jun 2023",
    nextPaymentAmount: "₦62,500",
    loanPurpose: "Home Renovation",
    disbursementDate: "20 Mar 2023",
    interestRate: "12%",
    monthlyRepayment: "₦62,500",
    totalRepayment: "₦825,000",
    status: "Active",
  },
  {
    id: "LN-2198",
    customerId: "CUS0045",
    loanType: "Business Loan",
    amount: "₦1,000,000",
    tenure: "24 Months",
    repaidAmount: "₦500,000",
    balance: "₦500,000",
    totalInterest: "₦200,000",
    amountRemaining: "₦500,000",
    nextPaymentDate: "25 Jun 2023",
    nextPaymentAmount: "₦50,000",
    loanPurpose: "Equipment Purchase",
    disbursementDate: "25 Feb 2023",
    interestRate: "15%",
    monthlyRepayment: "₦50,000",
    totalRepayment: "₦1,200,000",
    status: "Active",
  },
  {
    id: "LN-2197",
    customerId: "CUS0045",
    loanType: "Emergency Loan",
    amount: "₦250,000",
    tenure: "3 Months",
    repaidAmount: "₦250,000",
    balance: "₦0",
    totalInterest: "₦25,000",
    amountRemaining: "₦0",
    nextPaymentDate: "N/A",
    nextPaymentAmount: "N/A",
    loanPurpose: "Medical Expenses",
    disbursementDate: "15 Jan 2023",
    interestRate: "8%",
    monthlyRepayment: "₦91,667",
    totalRepayment: "₦275,000",
    status: "Completed",
  },
  {
    id: "LN-2190",
    customerId: "CUS0045",
    loanType: "Payday Loan",
    amount: "₦500,000",
    tenure: "40/60 Days",
    repaidAmount: "₦0",
    balance: "₦500,000",
    totalInterest: "₦50,000",
    amountRemaining: "₦500,000",
    nextPaymentDate: "15 Jun 2023",
    nextPaymentAmount: "₦25,000",
    loanPurpose: "Business Expansion",
    disbursementDate: "15 Apr 2023",
    interestRate: "10%",
    monthlyRepayment: "₦25,000",
    totalRepayment: "₦550,000",
    status: "Active",
  },
  {
    id: "LN-2180",
    customerId: "CUS0045",
    loanType: "Personal Loan",
    amount: "₦300,000",
    tenure: "30/60 Days",
    repaidAmount: "₦150,000",
    balance: "₦150,000",
    totalInterest: "₦30,000",
    amountRemaining: "₦150,000",
    nextPaymentDate: "10 Jun 2023",
    nextPaymentAmount: "₦15,000",
    loanPurpose: "Home Renovation",
    disbursementDate: "10 Mar 2023",
    interestRate: "10%",
    monthlyRepayment: "₦15,000",
    totalRepayment: "₦330,000",
    status: "Active",
  },
  {
    id: "LN-2170",
    customerId: "CUS0045",
    loanType: "Business Loan",
    amount: "₦750,000",
    tenure: "45/60 Days",
    repaidAmount: "₦300,000",
    balance: "₦450,000",
    totalInterest: "₦75,000",
    amountRemaining: "₦450,000",
    nextPaymentDate: "08 Jun 2023",
    nextPaymentAmount: "₦37,500",
    loanPurpose: "Equipment Purchase",
    disbursementDate: "08 Feb 2023",
    interestRate: "10%",
    monthlyRepayment: "₦37,500",
    totalRepayment: "₦825,000",
    status: "Active",
  },
];

export const repaymentHistory: RepaymentHistory[] = [
  {
    loanId: "LN-2190",
    date: "13, Feb 2025",
    amountPaid: "₦500,000",
    paymentMethod: "Payroll",
    status: "Success",
  },
  {
    loanId: "LN-2190",
    date: "13, Feb 2025",
    amountPaid: "₦500,000",
    paymentMethod: "Bank Transfer",
    status: "Pending",
  },
  {
    loanId: "LN-2190",
    date: "13, Feb 2025",
    amountPaid: "₦500,000",
    paymentMethod: "Payroll",
    status: "Success",
  },
  {
    loanId: "LN-2190",
    date: "13, Feb 2025",
    amountPaid: "₦500,000",
    paymentMethod: "Bank Transfer",
    status: "Failed",
  },
  {
    loanId: "LN-2180",
    date: "10, Feb 2025",
    amountPaid: "₦150,000",
    paymentMethod: "Payroll",
    status: "Success",
  },
  {
    loanId: "LN-2170",
    date: "08, Feb 2025",
    amountPaid: "₦300,000",
    paymentMethod: "Bank Transfer",
    status: "Success",
  },
  {
    loanId: "LN-2160",
    date: "05, Feb 2025",
    amountPaid: "₦200,000",
    paymentMethod: "Card Payment",
    status: "Pending",
  },
  {
    loanId: "LN-2150",
    date: "01, Feb 2025",
    amountPaid: "₦400,000",
    paymentMethod: "Payroll",
    status: "Failed",
  },
];
