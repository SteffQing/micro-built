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
      // A 4xx (signed out, forbidden, gone) won't change on a retry; anything else gets three more tries.
      retry: (failureCount, error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      onError: (error) => {
        if (isAxiosError(error)) {
          // Closing the "Confirm it's you" dialog (or being sent to set up 2FA) is the user's own choice: no toast.
          const code = error.response?.data?.code;
          if (code === "CONFIRMATION_REQUIRED" || code === "CONFIRMATION_SETUP_REQUIRED") return;
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