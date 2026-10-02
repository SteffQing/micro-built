import axios from "axios";
import { toast } from "sonner";

const API_ORIGIN = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003";
const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? API_ORIGIN;

// JSON API — same origin via Vercel rewrite, so first-party cookies and no CORS preflight.
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// Direct client for multipart uploads and file downloads — no custom headers,
// so no preflight. The session cookie travels because the API and FE share
// .microbuiltprime.com in production.
const uploads = axios.create({
  baseURL: NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

// Routes that should not redirect to /login on 401.
const redirectExemptRoutes = [
  "/",
  "/login",
  "/sign-up",
  "/verify-code",
  "/forgot-password",
  "/reset-password",
  "/two-factor",
];

function shouldRedirectOnUnauthorized(): boolean {
  if (typeof window === "undefined") return false;
  return !redirectExemptRoutes.includes(window.location.pathname);
}

function handleAuthError(status: number, code?: string) {
  if (status === 401 && shouldRedirectOnUnauthorized()) {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?next=${next}`;
  } else if (status === 403 && code === "TWO_FACTOR_SETUP_REQUIRED") {
    window.location.href = "/settings/security?setup=2fa";
  }
}

// Response interceptor for both clients.
function attachAuthInterceptor(client: ReturnType<typeof axios.create>) {
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const code = error.response?.data?.code as string | undefined;

        if (status === 401 || (status === 403 && code === "TWO_FACTOR_SETUP_REQUIRED")) {
          handleAuthError(status, code);
        }
      }
      return Promise.reject(error);
    },
  );
}

attachAuthInterceptor(api);
attachAuthInterceptor(uploads);

const handleViewQueues = async () => {
  try {
    const url = `${NEXT_PUBLIC_API_URL}/queues`;
    window.open(url, "_blank");
    toast.success("Opening queues dashboard");
  } catch {
    toast.error("Failed to open queues");
  }
};

export { api, uploads, handleViewQueues, NEXT_PUBLIC_API_URL };
