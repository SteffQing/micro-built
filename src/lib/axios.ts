import { clearUser, getSavedUser } from "@/store/auth";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { toast } from "sonner";

const isDev = process.env.NEXT_PUBLIC_DEV == "true";
const baseUrl = isDev
  ? "http://localhost:3003"
  : "https://api.microbuiltprime.com";

const api = axios.create({
  baseURL: baseUrl,
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
    console.error({ errorinterceptor: error });
  },
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (isDev) {
      console.error({ errorinterceptor: error, originalRequest });

      toast.error("An error occured", {
        description: error.response?.data?.message,
      });
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      clearUser();

      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

const handleViewQueues = async () => {
  try {
    const { data } = await api.get("/admin/queues/login", {
      withCredentials: true,
    });

    toast(data.message);
    window.open(`${baseUrl}/queues`, "_blank");
  } catch (error) {
    console.error({ error });
    toast.error("Failed to view queues");
  }
};
export { handleViewQueues, isDev, api, baseUrl };
