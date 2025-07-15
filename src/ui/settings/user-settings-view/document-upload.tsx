import { Upload, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

export type DocumentType = "id" | "proof_of_address";

interface DocumentUploadProps {
  userDocuments?: string[];
  onDocumentUpload?: (file: File, documentType: DocumentType) => Promise<void>;
}
export function DocumentUpload({
  userDocuments = [],
  onDocumentUpload,
}: DocumentUploadProps) {
  const [uploadingDocument, setUploadingDocument] =
    useState<DocumentType | null>(null);
  const [documentFiles, setDocumentFiles] = useState<
    Record<DocumentType, File | null>
  >({
    id: null,
    proof_of_address: null,
  });

  const handleFileUpload = async (file: File, documentType: DocumentType) => {
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

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadingDocument(documentType);

    try {
      setDocumentFiles((prev) => ({
        ...prev,
        [documentType]: file,
      }));

      if (onDocumentUpload) {
        await onDocumentUpload(file, documentType);
      }

      toast.success("Document uploaded successfully");
    } catch (error) {
      console.error("Failed to upload file:", error);
      toast.error("Failed to upload document");
      setDocumentFiles((prev) => ({
        ...prev,
        [documentType]: null,
      }));
    } finally {
      setUploadingDocument(null);
    }
  };

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
      userDocuments.some(
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

  const getDocumentDisplayName = (documentType: DocumentType) => {
    switch (documentType) {
      case "id":
        return "ID";
      case "proof_of_address":
        return "Utility Bill";
      default:
        return documentType;
    }
  };

  const renderDocumentRow = (documentType: DocumentType) => {
    const inputId = `${documentType}_input`;
    const status = getDocumentStatus(documentType);
    const displayName = getDocumentDisplayName(documentType);

    return (
      <div key={documentType} className="px-4 py-3">
        <div className="grid grid-cols-3 gap-4 items-center">
          <span className="">{displayName}</span>
          <div>
            {status === "uploading" && (
              <Badge className="bg-blue-100 text-blue-700 w-fit">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Uploading...
              </Badge>
            )}
            {status === "uploaded" && (
              <Badge className="bg-green-100 text-green-700 w-fit">
                Uploaded
              </Badge>
            )}
            {status === "pending" && (
              <Badge className="bg-orange-100 text-orange-700 w-fit">
                Pending
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {status === "uploaded" && (
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                View
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById(inputId)?.click()}
              disabled={uploadingDocument === documentType}
            >
              {uploadingDocument === documentType ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {status === "uploaded" ? "Replace" : "Upload"}
            </Button>
            <input
              id={inputId}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFileInputChange(e, documentType)}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h4 className="text-base font-medium mb-2">Upload Documents</h4>
      <p className="text-muted-foreground mb-4">
        Upload any document in any of the following categories to fast track
        your loan application.
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="font-medium mb-2">Supported documents:</p>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            • National ID (NIN), Drivers License, Passport, Voters Card, Bank
            Account Statement
          </li>
          <li>
            • Utility Bill (Electricity Bill, Internet or TV Cable, Water Bill)
          </li>
        </ul>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-muted px-4 py-3 border-b border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground">
            <span>Document</span>
            <span>Status</span>
            <span>Action</span>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {renderDocumentRow("id")}
          {renderDocumentRow("proof_of_address")}
        </div>
      </div>
    </div>
  );
}
