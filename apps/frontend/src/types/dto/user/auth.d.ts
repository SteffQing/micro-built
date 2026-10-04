// v2: Auth is handled via better-auth client. These legacy body DTOs are kept
// as stubs only if other code references the type names during migration.

type SignupBodyDto = {
  email?: string;
  phoneNumber?: string;
  name: string;
  password: string;
};

type LoginBodyDto = {
  email?: string;
  phoneNumber?: string;
  password: string;
};

type ResetPasswordBodyDto = {
  newPassword: string;
  token: string;
};

type ForgotPasswordBodyDto = {
  email: string;
};

type VerifyCodeBodyDto = {
  code: string;
  email: string;
};

type ResendCodeBodyDto = {
  email: string;
};

type UpdatePasswordBodyDto = {
  oldPassword: string;
  newPassword: string;
};
