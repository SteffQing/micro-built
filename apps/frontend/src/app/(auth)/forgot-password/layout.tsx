import type { Metadata } from "next";

// The page itself is a client component, so its title lives here.
export const metadata: Metadata = { title: "Forgot your password" };

export default function ForgotPasswordLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
