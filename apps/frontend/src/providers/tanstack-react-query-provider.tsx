"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import * as Sentry from "@sentry/nextjs";

// 4xx responses are user errors; report network failures and 5xx only.
function shouldReport(error: unknown) {
  if (!isAxiosError(error)) return true;
  const status = error.response?.status;
  return typeof status !== "number" || status >= 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
      retry: (_failureCount, error) => {
        if (isAxiosError(error) && error.response?.status === 401) {
          return false;
        }
        return true;
      },
    },
    mutations: {
      onError: (error) => {
        if (isAxiosError(error)) {
          toast.error(error.response?.data?.message || error.message);

          return;
        }

        toast.error(error.message);
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (shouldReport(error)) Sentry.captureException(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (shouldReport(error)) Sentry.captureException(error);
    },
  }),
});

export function ReactQueryClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}