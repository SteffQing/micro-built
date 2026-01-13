import { clearUser, getSavedUser } from "@/store/auth";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { toast } from "sonner";

const baseUrl =
  process.env.NEXT_PUBLIC_DEV == "true"
    ? "http://localhost:3003"
    : "https://micro-built.onrender.com";

export const api = axios.create({
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
  }
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    console.error({ errorinterceptor: error, originalRequest });
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
export { handleViewQueues };
