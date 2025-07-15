"use client";
import { useUserProvider } from "@/store/auth";
import { Loader2 } from "lucide-react";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <div className="w-full h-full items-center flex justify-center">
          <div className="flex items-center flex-col">
            <p>Loading...</p>
            <Loader2 className="text-primary animate-spin w-6 h-6" />
          </div>
        </div>
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <></>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p>Coming soon</p>
        </div>
      )}
    </>
  );
}
