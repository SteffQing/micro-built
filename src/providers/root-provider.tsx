"use client";

import { Toaster } from "@/components/ui/sonner";
import { ReactQueryClientProvider } from "./tanstack-react-query-provider";
import { ThemeProvider } from "./theme-provider";

export const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ReactQueryClientProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
        forcedTheme="light"
      >
        {/* <AuthProvider> */}
        {children}

        {/* </AuthProvider> */}
        <Toaster />
      </ThemeProvider>
    </ReactQueryClientProvider>
  );
};
