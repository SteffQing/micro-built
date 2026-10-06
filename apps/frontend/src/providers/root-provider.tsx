"use client";

import { Toaster } from "@/components/ui/sonner";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { ReactQueryClientProvider } from "./tanstack-react-query-provider";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";

export const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ReactQueryClientProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        <AuthProvider>{children}</AuthProvider>
        <ConfirmationDialog />
        <Toaster />
      </ThemeProvider>
    </ReactQueryClientProvider>
  );
};
