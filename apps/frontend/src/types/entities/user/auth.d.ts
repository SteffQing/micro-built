// v2: Auth is handled via better-auth client (@microbuilt/backend/auth-client).
// These legacy DTOs are no longer used; kept as stubs only if other code
// references the type names during migration.

type LoginDataDto = {
  token: string;
  user: {
    id: string;
    role: UserRole;
  };
};

type SignupResponseDto = { userId: string };

type VerifyCodeResponseDto = { userId: string };

type ForgotPasswordResponseDto = { email: string };

type ResetPasswordResponseDto = { email: string };
