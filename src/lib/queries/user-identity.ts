import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export interface UserIdentityResponse {
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  contact: string;
  documents: string[];
  residencyAddress: string;
  stateResidency: string;
  landmarkOrBusStop: string;
  nextOfKinName: string;
  nextOfKinContact: string;
  nextOfKinAddress: string;
  nextOfKinRelationship: string;
  gender: "Male" | "Female";
  maritalStatus: "Single" | "Married" | "Divorced" | "Widowed";
  verified: boolean;
}
export const userIdentityQueryOptions = queryOptions({
  queryKey: ["user","identity"],
  queryFn: async () => {
    return (await api.get<UserIdentityResponse>("/user/identity")).data;
  },
  staleTime: Infinity,
});



