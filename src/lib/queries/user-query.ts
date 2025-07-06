import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
// import { APIResponses } from "./query-types";

export const userQueryOptions = queryOptions({
  queryKey: ["user"],
  queryFn: async () => {
    return (await api.get<UserResponse>("/user")).data;
  },
  staleTime: Infinity,
});


export interface User {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "VENDOR"; // Add other roles as needed
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED"; // Add other statuses as needed
  avatar: string | null;
  contact: string | null;
}

export interface UserResponse {
  message: string;
  data: {
    user: User;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
