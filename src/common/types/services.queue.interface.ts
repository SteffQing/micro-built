export interface ImportedCustomerRow {
  // Required Logic (Based on your Producer validation)
  externalId: string | number; // Excel might parse 12345 as number
  name: string;
  totalRepayable: number | string;
  outstanding: number | string;

  // Optional / Derived
  organization?: string;
  command?: string;
  marketerName?: string;
  principal?: number | string;
  repaid?: number | string;
  monthlyDeduction?: number | string;

  // Dates (might come as Date object or string depending on Excel parsing)
  startDate?: Date | string;
  endDate?: Date | string;

  // Banking / Contact
  bankName?: string;
  accountNumber?: string | number;
  bvn: string | number;
  contact?: string | number;

  tenure: number | string;
}
