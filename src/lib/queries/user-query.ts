import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { User } from "./query-types";
// import { APIResponses } from "./query-types";

export const userQueryOptions = queryOptions({
  queryKey: ["user"],
  queryFn: async () => {
    return (await api.get<UserResponse>("/user")).data;
  },
  staleTime: Infinity,
});




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
