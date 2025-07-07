import { Edit2, Upload, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CreateUserIdentityRequest,
  userUserMutation,
  useUser,
} from "@/hooks/api/use-user";
import z from "zod";
import { useState, useRef, useEffect } from "react";
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

type DocumentType =
  | "national_id"
  | "utility_bill"
  | "bank_statement"
  | "passport"
  | "drivers_license"
  | "voters_card";

export function UserIdentity() {
  const { userIdentity } = useUser({ fetchUserIdentity: true });
  const { updateUserIdentity, createUserIdentity, uploadDocument } =
    userUserMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingDocument, setUploadingDocument] =
    useState<DocumentType | null>(null);
  const [documentFiles, setDocumentFiles] = useState<
    Record<DocumentType, File | null>
  >({
    national_id: null,
    utility_bill: null,
    bank_statement: null,
    passport: null,
    drivers_license: null,
    voters_card: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
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
      nextOfKinRelationship: "",
      maritalStatus: "Single",
    },
  });

  const { watch, reset } = form;
  const watchedValues = watch();
  console.log({ watchedValues });

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
        nextOfKinRelationship: identityData.nextOfKinRelationship || "",
        maritalStatus: identityData.maritalStatus || "Single",
      });
    }
  }, [userIdentity.data, reset]);

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
          nextOfKinRelationship: userIdentity.data.nextOfKinRelationship || "",
          maritalStatus: userIdentity.data.maritalStatus || "Single",
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

  const handleFileUpload = async (file: File, documentType: DocumentType) => {
    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload only images (JPG, PNG) or PDF files");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadingDocument(documentType);

    try {
      await uploadDocument.mutateAsync(file);
      // Update local state to show uploaded file
      setDocumentFiles((prev) => ({
        ...prev,
        [documentType]: file,
      }));
    } catch (error) {
      console.error("Failed to upload file:", error);
    } finally {
      setUploadingDocument(null);
    }
  };

  // Add this function to handle file input changes
  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    documentType: DocumentType
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, documentType);
    }
    event.target.value = "";
  };

  const isDocumentUploaded = (documentType: DocumentType) => {
    return (
      userIdentity.data?.documents?.some(
        (doc) =>
          doc.toLowerCase().includes(documentType.replace("_", " ")) ||
          doc.toLowerCase().includes(documentType.replace("_", ""))
      ) || documentFiles[documentType] !== null
    );
  };

  const getDocumentStatus = (documentType: DocumentType) => {
    if (uploadingDocument === documentType) return "uploading";
    if (isDocumentUploaded(documentType)) return "uploaded";
    return "pending";
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
                      placeholder="Enter first name"
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
                      placeholder="Enter last name"
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
                    <Input
                      {...field}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      placeholder="Enter relationship"
                    />
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
        </Form>
        {/* Identity Form */}

        {/* Upload Documents */}
        <div>
          <h4 className="text-base font-medium  mb-2">Upload Documents</h4>
          <p className="text-muted-foreground mb-4">
            Upload any document in any of the following categories to fast track
            your loan application.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="font-medium  mb-2">Supported documents:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                • National ID (NIN), Drivers License, Passport, Voters Card,
                Bank Account Statement
              </li>
              <li>
                • Utility Bill (Electricity Bill, Internet or TV Cable, Water
                Bill)
              </li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-700">
                <span>Document</span>
                <span>Status</span>
                <span>Action</span>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              <div className="px-4 py-3">
                <div className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-gray-900">National ID</span>
                  <div>
                    {getDocumentStatus("national_id") === "uploading" && (
                      <Badge className="bg-blue-100 text-blue-700 w-fit">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Uploading...
                      </Badge>
                    )}
                    {getDocumentStatus("national_id") === "uploaded" && (
                      <Badge className="bg-green-100 text-green-700 w-fit">
                        Uploaded
                      </Badge>
                    )}
                    {getDocumentStatus("national_id") === "pending" && (
                      <Badge className="bg-orange-100 text-orange-700 w-fit">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {getDocumentStatus("national_id") === "uploaded" && (
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("national_id_input")?.click()
                      }
                      disabled={uploadingDocument === "national_id"}
                    >
                      {uploadingDocument === "national_id" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {getDocumentStatus("national_id") === "uploaded"
                        ? "Replace"
                        : "Upload"}
                    </Button>
                    <input
                      id="national_id_input"
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileInputChange(e, "national_id")}
                    />
                  </div>
                </div>
              </div>

              {/* Utility Bill */}
              <div className="px-4 py-3">
                <div className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-gray-900">Utility Bill</span>
                  <div>
                    {getDocumentStatus("utility_bill") === "uploading" && (
                      <Badge className="bg-blue-100 text-blue-700 w-fit">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Uploading...
                      </Badge>
                    )}
                    {getDocumentStatus("utility_bill") === "uploaded" && (
                      <Badge className="bg-green-100 text-green-700 w-fit">
                        Uploaded
                      </Badge>
                    )}
                    {getDocumentStatus("utility_bill") === "pending" && (
                      <Badge className="bg-orange-100 text-orange-700 w-fit">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {getDocumentStatus("utility_bill") === "uploaded" && (
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("utility_bill_input")?.click()
                      }
                      disabled={uploadingDocument === "utility_bill"}
                    >
                      {uploadingDocument === "utility_bill" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {getDocumentStatus("utility_bill") === "uploaded"
                        ? "Replace"
                        : "Upload"}
                    </Button>
                    <input
                      id="utility_bill_input"
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileInputChange(e, "utility_bill")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
  nextOfKinRelationship: z.string().min(1, "Relationship is required"),
  maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"], {
    required_error: "Please select marital status",
  }),
}) satisfies z.ZodType<CreateUserIdentityRequest>;

type IdentityFormData = CreateUserIdentityRequest;
