import { Edit2, Upload, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreateUserIdentityRequest,
  useUserMutation,
  useUser,
} from "@/hooks/api/use-user";
import z from "zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DocumentUpload, DocumentType } from "./document-upload";
import { NextofKinRelationship } from "@/lib/queries/query-types";

export function UserIdentity() {
  const { userIdentity } = useUser({ fetchUserIdentity: true });
  const { updateUserIdentity, createUserIdentity } = useUserMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const form = useForm<IdentityFormData>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "Male",
      contact: "",
      residencyAddress: "",
      stateResidency: "",
      landmarkOrBusStop: "",
      nextOfKinName: "",
      nextOfKinContact: "",
      nextOfKinAddress: "",
      nextOfKinRelationship: "Other",
      maritalStatus: "Single",
      documents: [],
    },
  });

  const { watch, reset } = form;
  const watchedValues = watch();

  useEffect(() => {
    if (userIdentity.data) {
      const identityData = userIdentity.data;
      reset({
        firstName: identityData.firstName || "",
        lastName: identityData.lastName || "",
        dateOfBirth: identityData.dateOfBirth || "",
        gender: identityData.gender || "Male",
        contact: identityData.contact || "",
        residencyAddress: identityData.residencyAddress || "",
        stateResidency: identityData.stateResidency || "",
        landmarkOrBusStop: identityData.landmarkOrBusStop || "",
        nextOfKinName: identityData.nextOfKinName || "",
        nextOfKinContact: identityData.nextOfKinContact || "",
        nextOfKinAddress: identityData.nextOfKinAddress || "",
        nextOfKinRelationship:
          (identityData.nextOfKinRelationship as NextofKinRelationship) ||
          "Other",
        maritalStatus: identityData.maritalStatus || "Single",
        documents: identityData.documents || [],
      });
    }
  }, [userIdentity.data, reset, userIdentity.isLoading]);

  useEffect(() => {
    if (isEditing) {
      const subscription = form.watch(() => {
        setHasChanges(true);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, isEditing]);

  const handleEditToggle = () => {
    if (isEditing) {
      if (userIdentity.data) {
        reset({
          firstName: userIdentity.data.firstName || "",
          lastName: userIdentity.data.lastName || "",
          dateOfBirth: userIdentity.data.dateOfBirth || "",
          gender: userIdentity.data.gender || "Male",
          contact: userIdentity.data.contact || "",
          residencyAddress: userIdentity.data.residencyAddress || "",
          stateResidency: userIdentity.data.stateResidency || "",
          landmarkOrBusStop: userIdentity.data.landmarkOrBusStop || "",
          nextOfKinName: userIdentity.data.nextOfKinName || "",
          nextOfKinContact: userIdentity.data.nextOfKinContact || "",
          nextOfKinAddress: userIdentity.data.nextOfKinAddress || "",
          nextOfKinRelationship:
            (userIdentity.data
              .nextOfKinRelationship as NextofKinRelationship) || "Other",
          maritalStatus: userIdentity.data.maritalStatus || "Single",
          documents: userIdentity.data.documents || [],
        });
      }
      setHasChanges(false);
    }
    setIsEditing(!isEditing);
  };

  const onSubmit = async (data: CreateUserIdentityRequest) => {
    try {
      if (userIdentity.data) {
        await updateUserIdentity.mutateAsync(data);
      } else {
        await createUserIdentity.mutateAsync(data);
      }
      setIsEditing(false);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save identity:", error);
    }
  };

  const getButtonText = () => {
    if (!isEditing) return "Edit Details";
    if (hasChanges) return "Save Changes";
    return "Make Changes Now";
  };

  const getButtonAction = () => {
    if (!isEditing) return handleEditToggle;
    if (hasChanges) return form.handleSubmit(onSubmit);
    return () => {};
  };

  const handleDocumentUpload = async (
    file: File,
    documentType: DocumentType
  ) => {
    try {
      // Upload document via API
      // await uploadDocument.mutateAsync(file);

      // Update the documents array in the form
      const currentDocuments = form.getValues("documents");
      const documentName = `${documentType}_${file.name}`;

      // Add the new document to the array if it doesn't exist
      if (!currentDocuments.includes(documentName)) {
        form.setValue("documents", [...currentDocuments, documentName]);
        setHasChanges(true);
      }
    } catch (error) {
      console.error("Failed to upload document:", error);
      throw error; // Re-throw to let DocumentUpload handle the error
    }
  };

  return (
    <div className="max-w-4xl">
      <div className=" p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold ">User Identity</h2>
            <p className="text-muted-foreground mb-6">
              Fill in the following information to confirm your identity.
            </p>
          </div>
          <div className="flex gap-2">
            {isEditing && (
              <Button variant="outline" size="sm" onClick={handleEditToggle}>
                Cancel
              </Button>
            )}
            <Button
              variant={
                isEditing
                  ? hasChanges
                    ? "default"
                    : "secondary"
                  : "destructive"
              }
              size="sm"
              onClick={getButtonAction()}
              disabled={
                updateUserIdentity.isPending ||
                createUserIdentity.isPending ||
                (isEditing && !hasChanges)
              }
            >
              {updateUserIdentity.isPending || createUserIdentity.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Edit2 className="w-4 h-4 mr-2" />
              )}
              {getButtonText()}
            </Button>
          </div>
        </div>

        <Form {...form}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder={
                        userIdentity.data?.firstName || "Enter first name"
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder={
                        userIdentity.data?.lastName || "Enter last name"
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!isEditing}
                  >
                    <FormControl>
                      <SelectTrigger className={!isEditing ? "bg-gray-50" : ""}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder={userIdentity.data?.dateOfBirth || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter contact number"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stateResidency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State of Residence</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter state"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="residencyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Residential Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter residential address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="landmarkOrBusStop"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Landmark/Bus Stop (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter landmark or bus stop"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextOfKinName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next of Kin</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter next of kin name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextOfKinContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next of Kin Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter next of kin contact"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextOfKinAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next of Kin Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter next of kin address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextOfKinRelationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <FormControl>
                    {/* <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter relationship"
                    /> */}

                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={!isEditing}
                    >
                      <FormControl>
                        <SelectTrigger
                          className={!isEditing ? "bg-gray-50" : ""}
                        >
                          <SelectValue placeholder="Enter relationship" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Sibling">Sibling</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maritalStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marital Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!isEditing}
                  >
                    <FormControl>
                      <SelectTrigger className={!isEditing ? "bg-gray-50" : ""}>
                        <SelectValue placeholder="Select marital status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Divorced">Divorced</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <DocumentUpload
            userDocuments={userIdentity.data?.documents || []}
            onDocumentUpload={handleDocumentUpload}
          />
        </Form>
        {/* Identity Form */}
      </div>
    </div>
  );
}

const identitySchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["Male", "Female"], {
    required_error: "Please select a gender",
  }),
  contact: z.string().min(1, "Contact number is required"),
  residencyAddress: z.string().min(1, "Residential address is required"),
  stateResidency: z.string().min(1, "State of residence is required"),
  landmarkOrBusStop: z.string().min(1, "Landmark or bus stop is required"),
  nextOfKinName: z.string().min(1, "Next of kin name is required"),
  nextOfKinContact: z.string().min(1, "Next of kin contact is required"),
  nextOfKinAddress: z.string().min(1, "Next of kin address is required"),
  nextOfKinRelationship: z.enum([
    "Spouse",
    "Parent",
    "Child",
    "Sibling",
    "Other",
  ]),
  maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"], {
    required_error: "Please select marital status",
  }),
  documents: z.array(z.string()),
}) satisfies z.ZodType<CreateUserIdentityRequest>;

type IdentityFormData = CreateUserIdentityRequest;
