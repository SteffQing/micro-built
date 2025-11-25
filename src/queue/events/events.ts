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

enum CustomerPPIEvents {
  userCreateIdentity = 'user-create-identity',
  userUpdateIdentity = 'user-update-identity',
  userCreatePayroll = 'user-create-payroll-info',
  userUpdatePayroll = 'user-update-payroll-info',
  userCreatePayment = 'user-create-payment-method',
  userUpdatePayment = 'user-update-payment-method',
}

enum AdminEvents {
  adminInvite = 'admin-invite',
  adminResolveRepayment = 'admin-resolve-manual-repayment',
  onboardCustomer = 'onboard-customer',
  approveCommodityLoan = 'admin-approve-commodity-loan',
  disburseLoan = 'admin-disburse-loan',
}

export { Public, Auth, UserEvents, AdminEvents, CustomerPPIEvents };
