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
