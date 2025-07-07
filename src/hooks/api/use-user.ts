import { api } from "@/lib/axios";
import { DocumentUploadResponse } from "@/lib/queries/query-types";
import { userIdentityQueryOptions } from "@/lib/queries/user-identity";
import { userQueryOptions } from "@/lib/queries/user-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useUser = ({
  fetchUserIdentity = false,
}: {
  fetchUserIdentity?: boolean;
}) => {
  const { data, isLoading, isError, error } = useQuery({
    ...userQueryOptions,
  });

  const {
    data: identityData,
    isLoading: identityLoading,
    isError: identityError,
    error: identityErrorDetails,
  } = useQuery({
    ...userIdentityQueryOptions,
    enabled: fetchUserIdentity,
  });

  const user = data?.data.user;
  const userId = user?.id;
  const userEmail = user?.email;
  const userRole = user?.role;
  const userName = user?.name;
  const userStatus = user?.status;

  const avatar = user?.avatar || "/profile_dummy";

  const isAdmin = user?.role === "ADMIN";
  const isCustomer = userRole === "CUSTOMER";

  return {
    user: {
      user,
      userId,
      userEmail,
      userRole,
      userName,
      userStatus,
      avatar,
      isAdmin,
      isCustomer,
      isLoading,
      isError,
      error,
    },
    userIdentity: {
      data: identityData,
      isLoading: identityLoading,
      isError: identityError,
      error: identityErrorDetails,
    },
  };
};

export const userUserMutation = () => {
  const queryClient = useQueryClient();

  const createUserIdentity = useMutation({
    mutationFn: async (
      data: CreateUserIdentityRequest
    ): Promise<UserIdentityResponse> => {
      const response = await api.post<UserIdentityResponse>(
        "/user/identity",
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-identity"] });
      toast.success("Identity information submitted successfully!");
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(
        error.response?.data?.message || "Failed to submit identity information"
      );
    },
  });

  const updateUserIdentity = useMutation({
    mutationFn: async (
      data: CreateUserIdentityRequest
    ): Promise<UserIdentityResponse> => {
      const response = await api.patch<UserIdentityResponse>(
        "/user/identity",
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-identity"] });
      toast.success("Identity information updated successfully!");
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(
        error.response?.data?.message || "Failed to update identity information"
      );
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async (file: File): Promise<DocumentUploadResponse> => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post<DocumentUploadResponse>(
        "/user/identity/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    },
    onSuccess: (data: DocumentUploadResponse) => {
      queryClient.invalidateQueries({ queryKey: ["user-identity"] });
      toast.success(data.message || "Document uploaded successfully!");
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || "Failed to upload document");
    },
  });
  return {
    updateUserIdentity,
    createUserIdentity,
    uploadDocument,
  };
};



//typesTYPES
export interface CreateUserIdentityRequest {
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  contact: string;
  residencyAddress: string;
  stateResidency: string;
  landmarkOrBusStop: string;
  nextOfKinName: string;
  nextOfKinContact: string;
  nextOfKinAddress: string;
  nextOfKinRelationship: string;
  gender: "Male" | "Female";
  maritalStatus: "Single" | "Married" | "Divorced" | "Widowed";
}

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
