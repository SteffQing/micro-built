enum Public {
  joinWaitlist = 'public-join-waitlist',
  joinNewsletter = 'public-join-newsletter',
}

enum Auth {
  userSignUp = 'auth-user-signup',
  userResendCode = 'auth-user-resend-code',
  userResetPassword = 'auth-user-reset-password',
  userForgotPassword = 'auth-user-forgot-password',
  userUpdatePassword = 'user-auth-update-password',
}

enum UserEvents {
  userLoanRequest = 'user-loan-request',
  userLoanUpdate = 'user-loan-update',
  userLoanDelete = 'user-loan-delete',
  userCommodityLoanRequest = 'user-commodity-loan-request',
}

export { Public, Auth, UserEvents };
