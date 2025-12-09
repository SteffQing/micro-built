export interface ImportedCustomerRow {
  externalId: string | number;
  name: string;
  tenure: number | string;
  principal: number | string;
  totalRepayable: number | string;
  outstanding: number | string;
  accountNumber: string | number;
  bvn: string | number;
  contact: string | number;
  organization: string;
  command: string;
  startDate: Date | string;

  marketerName?: string;
  repaid?: number | string;
  monthlyDeduction?: number | string;
  bankName?: string;
  endDate?: Date | string;
}

export interface ExistingCustomerJob {
  columnIndexToKey: Record<number, string>;
  rawData: any[][];
  headerRowIndex: number;
}

export interface AdminCache {
  id: string;
  name: string;
}
