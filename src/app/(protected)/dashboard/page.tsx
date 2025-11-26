"use client";
import { useUserProvider } from "@/store/auth";
import { AdminDashboardPage } from "@/ui/dashboard/admin-dashboard";
import { UserDashboardPage } from "@/ui/dashboard/user-dashboard";
import { Loader2 } from "lucide-react";

export default function Page() {
	const { userRole, isUserLoading, errorUser } = useUserProvider();
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
				<UserDashboardPage />
			) : userRole === "MARKETER" ? (
				<div>
					<p>COMING SOON</p>
				</div>
			) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
				<AdminDashboardPage />
			) : (
				!isUserLoading && errorUser && <div>An ERROR Occured</div>
			)}
		</>
	);
}
