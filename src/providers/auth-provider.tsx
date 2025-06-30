import { useUserProvider } from "@/store/auth";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  useUserProvider();
  return <>{children}</>;
};
