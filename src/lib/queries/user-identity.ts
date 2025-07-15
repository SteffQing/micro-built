import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { NextofKinRelationship } from "./query-types";

// export interface UserIdentityResponse {
//   data: {
//     dateOfBirth: string;
//     firstName: string;
//     lastName: string;
//     contact: string;
//     documents: string[];
//     residencyAddress: string;
//     stateResidency: string;
//     landmarkOrBusStop: string;
//     nextOfKinName: string;
//     nextOfKinContact: string;
//     nextOfKinAddress: string;
//     nextOfKinRelationship: string;
//     gender: "Male" | "Female";
//     maritalStatus: "Single" | "Married" | "Divorced" | "Widowed";
//     verified: boolean;
//   };
// }
export interface UserIdentityResponse {
  data: {
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
    nextOfKinRelationship: NextofKinRelationship;
    gender: "Male" | "Female";
    maritalStatus: "Single" | "Married" | "Divorced" | "Widowed";
    verified: boolean;
  };
  message: string;
}

export const userIdentityQueryOptions = queryOptions({
  queryKey: ["user","identity"],
  queryFn: async () => {
    return (await api.get<UserIdentityResponse>("/user/identity")).data.data;
  },
  staleTime: Infinity,
});



