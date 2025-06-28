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
