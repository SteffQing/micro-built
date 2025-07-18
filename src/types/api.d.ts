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
