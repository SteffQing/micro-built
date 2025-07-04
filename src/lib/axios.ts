import { clearUser, getSavedUser } from "@/store/auth";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { toast } from "sonner";

export const api = axios.create({
  baseURL: "https://micro-built.onrender.com",
});

api.interceptors.request.use(
  async (config) => {
    const userAuthority = getSavedUser();
    
    if (userAuthority && userAuthority.accessToken.length > 0) {
      console.log({ userAuthority });
      config.headers.Authorization = `Bearer ${userAuthority?.accessToken}`;
    } else {
      clearUser();
      toast(
        "Your session has expired. Or not authorized, Please log in again."
      );
      window.location.href = "/login";
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

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      clearUser();
      toast(
        "API:: INTERCEPTOR:::Your session has expired. Or not authorized, Please log in again."
      );
      window.location.href = "/login";
    }

    console.log({ errorinterceptor22: error });
  }
);
