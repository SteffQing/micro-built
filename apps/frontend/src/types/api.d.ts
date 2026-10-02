type Meta = {
  total: number;
  page: number;
  limit: number;
};

type ApiRes<T> = {
  data?: T | null;
  message: string;
  error?: string;
  meta?: Meta;
  statusCode?: number;
};

type PaginatedApiQuery = Partial<{
  limit: number;
  page: number;
}>;

/** v2: Loan figures — carried everywhere a loan is returned. */
type LoanFigures = {
  owed: number;
  repaid: number;
  outstanding: number;
  principal: number;
  interestBooked: number;
  penaltyBooked: number;
  tenure: number;
  remainingMonths: number;
  monthly: number | null;
};
