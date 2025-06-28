import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { APIResponses } from "./query-types";

export const userQuery = queryOptions({
  queryKey: ["user"],
  queryFn: async () => {
    return (await api.get<APIResponses["user"]>("/user")).data;
  },
  staleTime: Infinity,
});
