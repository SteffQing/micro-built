import { clearUser, getSavedUser } from "@/store/auth";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { toast } from "sonner";

export const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_DEV == "true"
      ? "http://localhost:3003"
      : "https://micro-built.onrender.com",
});

api.interceptors.request.use(
  async (config) => {
    const userAuthority = getSavedUser();
    if (userAuthority && userAuthority.accessToken.length > 0) {
      config.headers.Authorization = `Bearer ${userAuthority?.accessToken}`;
    }
    return config;
  },
  (error) => {
    console.log({ errorinterceptor: error });
  }
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    console.log({ errorinterceptor: error, originalRequest });
    toast.error("An error occured", {
      description: error.response?.data?.message,
    });

    if (error.response?.status === 401 && !originalRequest._retry) {
      clearUser();
      toast(
        "Your session has expired. Or not authorized, Please log in again."
      );
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
