# 04 — Frontend Integration (Next.js 16)

**Repo:** `micro-built-frontend`. Goal: replace the custom `/auth/*` mutations with the Better Auth client, **while keeping** the existing axios-bearer pattern for resource calls so the rest of the app is untouched.

The design (00 §2): `authClient` owns the **session** (cross-subdomain cookie) for auth operations; `axios` carries the **JWT** to the resource API.

---

## 1. Install

```bash
cd micro-built-frontend
pnpm add better-auth
```

## 2. Env

```
# .env.local
NEXT_PUBLIC_BETTER_AUTH_URL=https://api.microbuiltprime.com   # = backend BETTER_AUTH_URL
# dev:
# NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3003
```

Existing `NEXT_PUBLIC_DEV` and the axios `baseUrl` logic stay.

---

## 3. The auth client

Create `src/lib/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [jwtClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

`jwtClient()` adds `authClient.token()` → fetches a fresh JWT using the active session.

---

## 4. Token storage — adapt the existing `src/store/auth.ts`

Today `saveUser/getSavedUser/clearUser` persist `userAuthority.accessToken` in `localStorage`, and the axios interceptor reads it. **Keep this contract** — only the *source* of the token changes (now a Better Auth JWT). Minimal edits:

```ts
// src/store/auth.ts — storage helpers stay; add a token refresh helper
import { authClient } from "@/lib/auth-client";

// fetch a fresh JWT from the live session and store it under the existing key
export async function refreshAccessToken(): Promise<string | null> {
  const { data } = await authClient.token(); // uses session cookie
  if (data?.token) {
    saveUser({ accessToken: data.token });
    return data.token;
  }
  return null;
}
```

`saveUser`, `getSavedUser`, `clearUser`, the `userAuthoritySchema`, and the `localStorage` key (`userAuthority`) are unchanged — so `src/lib/axios.ts`'s request interceptor keeps working verbatim.

---

## 5. Axios interceptors — `src/lib/axios.ts`

The **request** interceptor is unchanged (still attaches `Bearer <accessToken>`).

Upgrade the **response** interceptor so a 401 first tries a JWT refresh from the live session before bouncing to `/login`:

```ts
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const fresh = await refreshAccessToken().catch(() => null);
      if (fresh) {
        original.headers = { ...original.headers, Authorization: `Bearer ${fresh}` };
        return api(original); // retry once with a new JWT
      }
      // session truly gone
      clearUser();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
```

> **v1 shortcut:** if you set `jwt.expirationTime: "7d"` on the backend (02 §3), 401s-from-expiry are rare and you can keep the *current* interceptor as-is and skip `refreshAccessToken`. Add the refresh path when you shorten JWT lifetime.

---

## 6. Login — `src/ui/auth/login-form.tsx`

Replace the `useMutation(login)` call. Email tab and mobile tab both end at `signIn.email`; the mobile tab derives the synthetic email (00 §7b).

```ts
import { signIn } from "@/lib/auth-client";
import { refreshAccessToken } from "@/store/auth";

async function onSubmit(values: LoginFormValues) {
  const email =
    activeTab === "email"
      ? values.email!
      : `${values.contact}@contact.microbuilt.local`; // synthetic email path

  const { error } = await signIn.email({ email, password: values.password });
  if (error) {
    toast.error(error.message ?? "Login failed");
    return;
  }
  await refreshAccessToken();      // mint + store the JWT for axios
  toast.success("Login successful");
  router.push("/dashboard");
}
```

If you adopt the `phoneNumber` plugin instead, the mobile tab calls `signIn.phoneNumber(...)` — but that's out of the agreed scope.

---

## 7. Signup — `src/app/(auth)/sign-up/page.tsx`

```ts
import { signUp } from "@/lib/auth-client";

const email =
  mode === "email" ? values.email! : `${values.contact}@contact.microbuilt.local`;

const { error } = await signUp.email({
  email,
  password: values.password,
  name: values.name,
});
// email users: BA auto-sends the verification link (sendOnSignUp).
// contact users: backend hook set status FLAGGED + emailVerified true → go straight to login.
```

The backend `databaseHooks.user.create.before` (02 §3) reproduces the old `status` logic, so signup outcomes match today.

---

## 8. Email verification — `src/app/(auth)/verify-code` → `verify-email`

Decision 00 §7a (link-based, recommended). Replace the 6-digit code page with a landing route that consumes the link's token:

```ts
// src/app/(auth)/verify-email/page.tsx (client)
import { authClient } from "@/lib/auth-client";
const token = useSearchParams().get("token");
useEffect(() => {
  if (!token) return;
  authClient.verifyEmail({ query: { token } }).then(({ error }) => {
    toast[error ? "error" : "success"](error ? error.message : "Email verified — please log in");
    if (!error) router.push("/login");
  });
}, [token]);
```

Delete the old `verify-code` / `resend-code` mutations. Better Auth exposes `authClient.sendVerificationEmail({ email })` for "resend".

> If product insists on keeping the 6-digit code, do **not** do this section — instead add the `emailOTP` plugin on both ends (out of core-parity scope).

---

## 9. Forgot / reset password — `src/app/(auth)/forgot-password`, `reset-password`

Reset was already token-based, so this is a near 1:1 swap.

```ts
// forgot-password
await authClient.requestPasswordReset({
  email,
  redirectTo: `${window.location.origin}/reset-password`,
});

// reset-password (token comes from the email link query param)
const token = useSearchParams().get("token");
await authClient.resetPassword({ newPassword, token });
```

Remove the `forgotPassword` / `resetPassword` axios mutations from `src/lib/mutations/user/auth.ts`.

---

## 10. Logout & route gating — `src/store/auth.ts`, `src/providers/auth-provider.tsx`

`useUserProvider` keeps gating via `GET /user` (a JWT-protected resource route) — **unchanged**. Only `logout` switches to the Better Auth session:

```ts
const logout = async () => {
  await authClient.signOut();   // kills the session cookie server-side
  clearUser();                  // clears the stored JWT
  queryClient.removeQueries(getUser);
  router.push("/login");
};
```

The `authWebRoutes` / `publicWebRoutes` arrays and redirect effects stay as-is. Add `/verify-email` to `authWebRoutes` (replacing `/verify-code`).

---

## 11. The mutations file — `src/lib/mutations/user/auth.ts`

Net effect: this file mostly disappears. `signup`, `login`, `verifyCode`, `forgotPassword`, `resetPassword`, `resendCode` are replaced by `authClient` calls in the forms above. Keep any non-auth mutations elsewhere untouched. The DTO types in `src/types/dto/user/auth.d.ts` can stay for form typing or be slimmed.

---

## 12. Fallback: pure-bearer (no cross-subdomain cookies)

If you can't enable cross-subdomain cookies, run Better Auth in header-only mode:

- Backend: `bearer()` plugin already added; rely on `Authorization` for `/api/auth/*` too.
- `createAuthClient` with `fetchOptions` that read `set-auth-token` from sign-in responses and store the **session token**, then send it as `Authorization: Bearer <sessionToken>` on subsequent `authClient` calls.
- Still fetch the **JWT** via `authClient.token()` for the axios/resource path.

This trades automatic cookie handling for manual two-token storage. Prefer the cross-subdomain cookie path unless a constraint forbids it.

---

## 13. Files touched (frontend)

| File | Change |
| --- | --- |
| `src/lib/auth-client.ts` | **new** — Better Auth React client |
| `src/store/auth.ts` | add `refreshAccessToken`; switch `logout` to `signOut`; add `/verify-email` route |
| `src/lib/axios.ts` | response interceptor refreshes JWT on 401 (optional in v1) |
| `src/ui/auth/login-form.tsx` | `signIn.email` (+ synthetic email for mobile) |
| `src/app/(auth)/sign-up/page.tsx` | `signUp.email` |
| `src/app/(auth)/verify-code/*` → `verify-email/*` | link-based verification |
| `src/app/(auth)/forgot-password/page.tsx` | `requestPasswordReset` |
| `src/app/(auth)/reset-password/page.tsx` | `resetPassword({ token })` |
| `src/lib/mutations/user/auth.ts` | delete auth mutations |
| `src/providers/auth-provider.tsx` | unchanged (still gates via `GET /user`) |
