"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UserSiteHeader } from "@/components/user-site-header";
import { useAuthStore, useUser } from "@/store/auth";
import { isAPISuccess } from "@/lib/queries/query-types";
import { useEffect } from "react";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data, isLoading, error } = useUser();
  console.log({
    data,
    isLoading,
    error,
  });
  const { setUser, setLoading, setError } = useAuthStore();

  useEffect(() => {
    setLoading(isLoading);
    setError(error?.message || null);
    if (data) {
      if (isAPISuccess(data)) {
        setUser({
          role: data.role,
          profile: {
            id: data.id,
            name: data.name,
            contact: data.contact,
            avatar: data.avatar,
            email: data.email,
            status: data.status,
          },
        });
      } else {
        setError(data.message);
      }
    }
  }, [data, isLoading, error, setUser, setLoading, setError]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <UserSiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
