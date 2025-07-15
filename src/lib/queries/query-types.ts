export interface User {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "VENDOR";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  avatar: string | null;
  contact: string | null;
}

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

export type NextofKinRelationship =
  | "Spouse"
  | "Parent"
  | "Child"
  | "Sibling"
  | "Other";

export interface APIErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
}

export interface DocumentUploadResponse {
  message: string;
  data: {
    url: string;
  };
}

export interface LoginUser {
  id: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "VENDOR";
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

export function isAPIError(response: unknown): response is APIErrorResponse {
  return (
    response !== null &&
    typeof response === "object" &&
    "statusCode" in response &&
    "message" in response &&
    typeof (response as APIErrorResponse).statusCode === "number" &&
    typeof (response as APIErrorResponse).message === "string"
  );
}

export function isAPISuccess<T>(response: APIResponse<T>): response is T {
  return !isAPIError(response);
}
