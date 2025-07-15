
export interface Bank {
  id: number;
  name: string;
  code: string;
  slug: string;
}

export interface PaymentMethodData {
  bankName: string;
  accountNumber: string;
  accountName: string;
}
