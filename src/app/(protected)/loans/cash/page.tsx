"use client";
import { useUserProvider } from "@/store/auth";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? (
        <></>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p>Coming soon</p>
        </div>
      )}
    </>
  );
}
