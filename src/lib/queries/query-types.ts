export type LoanStatus =
  | "PENDING"
  | "PREVIEW"
  | "REJECTED"
  | "ACCEPTED"
  | "APPROVED"
  | "DISBURSED"
  | "REPAID";

export type LoanCategory =
  | "EDUCATION"
  | "PERSONAL"
  | "BUSINESS"
  | "MEDICAL"
  | "RENT"
  | "TRAVEL"
  | "AGRICULTURE"
  | "UTILITIES"
  | "EMERGENCY"
  | "OTHERS"
  | "ASSET_PURCHASE";

export type RepaymentStatus =
  | "FULFILLED"
  | "OVERPAID"
  | "PARTIAL"
  | "FAILED"
  | "AWAITING"
  | "MANUAL_RESOLUTION";

export interface APIErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  contact: string;
  avatar: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  role: "CUSTOMER" | "ADMIN" | "MODERATOR";
}

export interface LoginUser {
  id: string;
  role: "CUSTOMER" | "ADMIN" | "MODERATOR";
}

export interface LoginData {
  token: string;
  user: LoginUser;
}

export interface LoginSuccessResponse {
  message: string;
  data: LoginData;
}

export type APIResponse<T> = T | APIErrorResponse;

export interface APIResponses {
  user: APIResponse<User>;
  login: APIResponse<LoginSuccessResponse>;
}

export function isAPIError(response: any): response is APIErrorResponse {
  return (
    response &&
    typeof response === "object" &&
    "statusCode" in response &&
    "message" in response
  );
}

export function isAPISuccess<T>(response: APIResponse<T>): response is T {
  return !isAPIError(response);
}
