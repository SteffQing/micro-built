"use client";
import { useUserProvider } from "@/store/auth";
import { AdminCustomersPage } from "@/ui/customers/admin-view";
import { MarketerCustomersPage } from "@/ui/customers/marketer-view";
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
				<p>Not applicable to customer</p>
			) : userRole === "MARKETER" ? (
				<MarketerCustomersPage />
			) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
				<AdminCustomersPage />
			) : (
				!isUserLoading && errorUser && <div>An ERROR Occured</div>
			)}
		</>
	);
}
