"use client";

import { getUser } from "@/lib/queries/user";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";

const userAuthoritySchema = z.object({
	accessToken: z.string(),
});

type UserAuthority = z.infer<typeof userAuthoritySchema>;
const authWebRoutes = [
	"/login",
	"/sign-up",
	"/verify-code",
	"/resend-code",
	"/forgot-password",
	"/reset-password",
];
const publicWebRoutes = ["/", "/about"];

export const useUserProvider = () => {
	const router = useRouter();
	const pathname = usePathname();
	const isAuthPage = authWebRoutes.includes(pathname);
	const isPublicPage = publicWebRoutes.includes(pathname);
	const userAuthority = getSavedUser();

	console.log(userAuthority);

	const shouldFetchUser =
		!authWebRoutes.includes(pathname) && userAuthority?.accessToken !== "";

	const logout = () => {
		saveUser({ accessToken: "" });
		router.push("/login");
		queryClient.removeQueries(getUser);
	};

	const {
		data: userDetails,
		isLoading: isUserLoading,
		error: errorUser,
	} = useQuery({
		...getUser,
		enabled: shouldFetchUser,
	});

	const user = userDetails?.data;
	const userRole = user?.role;

	useEffect(() => {
		if (isPublicPage) return;

		if (user && !isUserLoading && !errorUser) {
			if (isAuthPage) {
				router.push("/dashboard");
			}
		}

		if (!user && !isUserLoading && !errorUser) {
			if (!isAuthPage) {
				router.push("/login");
			}
		}

		if (errorUser && !isUserLoading && !isPublicPage) {
			router.push("/login");
		}
	}, [
		user,
		isUserLoading,
		errorUser,
		pathname,
		router,
		isAuthPage,
		isPublicPage,
	]);
	return {
		user,
		userRole,
		userDetails,
		isUserLoading,
		errorUser,
		logout,
	};
};

export function clearUser() {
	if (typeof window === "undefined") {
		return null;
	}
	window.localStorage.removeItem("userAuthority");
}

export function saveUser(userAuthority: UserAuthority) {
	if (typeof window === "undefined") {
		return null;
	}
	window.localStorage.setItem("userAuthority", JSON.stringify(userAuthority));
}

export function getSavedUser() {
	if (typeof window === "undefined") {
		return null;
	}
	const user = window.localStorage.getItem("userAuthority");
	if (!user) return null;
	try {
		const result = userAuthoritySchema.safeParse(JSON.parse(user));
		return result.success ? result.data : null;
	} catch {
		clearUser();
		return null;
	}
}

export function logout() {
	clearUser();
	queryClient.invalidateQueries(getUser);
	window.location.href = "/login";
}
