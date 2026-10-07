import axios, { type InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import { requestConfirmation, type ConfirmationMethods, type ConfirmMode } from "./confirmation";

const API_ORIGIN = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003";
const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? API_ORIGIN;

// JSON API — called directly (hybrid routing): the Vercel hop cost 300+ ms per call. The session cookie is
// Domain=microbuiltprime.com so it travels to the API subdomain; the API answers CORS preflights with a 2 h cache.
// Only /api/auth/* (better-auth client) still goes through the frontend origin for the edge headers.
const api = axios.create({
  baseURL: NEXT_PUBLIC_API_URL,
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

let signingOut = false;

/**
 * The user is signing out on purpose: the requests still in flight will get 401s once the cookie is gone, and
 * those must not start the expired-session redirect (the sign-out does its own).
 */
function beginSignOut() {
  signingOut = true;
}

// A 401 means the API no longer accepts the session, but the browser still holds its (httpOnly) cookie, and
// proxy.ts treats any session cookie as signed in, so a plain redirect to /login bounces straight back here.
// Sign out first so better-auth clears the cookie, and flag the redirect so the proxy lets it through even if
// that call fails.
async function expireSession() {
  if (signingOut) return;
  signingOut = true;
  const next = encodeURIComponent(window.location.pathname);
  try {
    const { signOut } = await import("@/lib/auth-client");
    await signOut();
  } catch {
    // The cookie may already be gone or the API unreachable; the flagged redirect still breaks the loop.
  }
  window.location.replace(`/login?next=${next}&expired=1`);
}

function handleAuthError(status: number, code?: string) {
  if (status === 401 && shouldRedirectOnUnauthorized()) {
    void expireSession();
  } else if (
    status === 403 &&
    code === "TWO_FACTOR_SETUP_REQUIRED" &&
    !window.location.pathname.startsWith("/settings")
  ) {
    window.location.href = "/settings?view=authentication&setup=2fa";
  }
}

// The API refused the route for the user's role. The tab may hold a role that has since changed: read the account
// again, and useUserProvider reloads the app if the role differs. One check at a time.
let checkingRole = false;
async function recheckRole() {
  if (checkingRole || typeof window === "undefined") return;
  checkingRole = true;
  try {
    const [{ queryClient }, { getUser }] = await Promise.all([
      import("@/providers/tanstack-react-query-provider"),
      import("@/lib/queries/user"),
    ]);
    await queryClient.refetchQueries({ queryKey: getUser.queryKey, exact: true });
  } catch {
    // Nothing to do: the request already failed with its own message.
  } finally {
    checkingRole = false;
  }
}

type ConfirmableConfig = InternalAxiosRequestConfig & { confirmed?: boolean };

// Response interceptor for both clients. A gated action (403 CONFIRMATION_REQUIRED) asks for a code or passkey and is
// sent again with the token: the X-Confirmation header, or `?confirmation=` on `uploads`, which stays header-free so
// multipart posts skip the CORS preflight.
function attachAuthInterceptor(client: ReturnType<typeof axios.create>, tokenInQuery: boolean) {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data as
          | { code?: string; mode?: ConfirmMode; methods?: ConfirmationMethods; message?: string }
          | undefined;
        const code = data?.code;

        if (status === 401 || (status === 403 && code === "TWO_FACTOR_SETUP_REQUIRED")) {
          handleAuthError(status, code);
        }

        const config = error.config as ConfirmableConfig | undefined;
        if (status === 403 && code === "CONFIRMATION_REQUIRED" && config && !config.confirmed) {
          const token = await requestConfirmation(data?.mode ?? "action", data?.methods ?? { totp: true, passkey: false });
          if (token) {
            config.confirmed = true;
            if (tokenInQuery) config.params = { ...(config.params ?? {}), confirmation: token };
            else config.headers.set("X-Confirmation", token);
            return client(config);
          }
        }

        if (status === 403 && code === "ROLE_FORBIDDEN") void recheckRole();

        if (status === 403 && code === "CONFIRMATION_SETUP_REQUIRED") {
          // The dialog explains and links to settings; the request still fails.
          void requestConfirmation(data?.mode ?? "action", { totp: false, passkey: false });
        }
      }
      return Promise.reject(error);
    },
  );
}

attachAuthInterceptor(api, false);
attachAuthInterceptor(uploads, true);

const handleViewQueues = async () => {
  try {
    const url = `${NEXT_PUBLIC_API_URL}/queues`;
    window.open(url, "_blank");
    toast.success("Opening queues dashboard");
  } catch {
    toast.error("Failed to open queues");
  }
};

export { api, uploads, handleViewQueues, NEXT_PUBLIC_API_URL, beginSignOut };
