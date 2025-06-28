import { useAuthStore } from "@/store/auth";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { toast } from "sonner";

export const api = axios.create({
	baseURL: "https://micro-built.onrender.com",
});

api.interceptors.request.use(
	async (config) => {
		const user = useAuthStore.getState().user;
		if (user) {
			config.headers.Authorization = `Bearer ${user.accessToken}`;
			console.log({ user });
			console.log({ userToken: user.accessToken });
		}
		return config;
	},
	(error) => {
		console.log({ errorinterceptor: error });
		// return Promise.reject(error);
	},
);

// Add a response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => response, // Pass through successful responses
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/login"
    ) {

    }

    // const authEndpoints = [
    //   "/auth/login",
    //   "/auth/signup",
    //   "/auth/verify-code",
    //   "/auth/resend-code",
    //   "/auth/forgot-password",
    //   "/auth/reset-password",
    // ];
    // const isAuthEndpoint = authEndpoints.some((endpoint) =>
    //   originalRequest.url?.includes(endpoint)
    // // );
    // if (!isAuthEndpoint) {
    //   console.log("Token expired or invalid, logging out");
    //   // Clear user state
    //   useAuthStore.getState().clearUser();
    //   if (typeof window !== "undefined") {
    //     toast("Your session has expired. Please log in again.");
    //   }
    //   window.location.href = "/login";
    // }

    // Reject other errors
    console.log({ errorinterceptor22: error });
    // return Promise.reject(error);
  }
);
