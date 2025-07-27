type SignupBodyDto = {
  email?: string;
  contact?: string;
  name: string;
  password: string;
};

type LoginBodyDto = {
  email?: string;
  contact?: string;
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
