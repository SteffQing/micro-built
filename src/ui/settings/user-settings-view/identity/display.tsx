"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function UserIdentitySection({ gender, dateOfBirth, documents, ...props }: UserIdentityDto) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-semibold">User Identity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Gender</Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{gender}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Date of Birth</Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{dateOfBirth}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">State of Residence</Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{props.stateResidency}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Residential Address</Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{props.residencyAddress}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Next of Kin</Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{props.nextOfKinName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Next of Kin Phone Number</Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{props.nextOfKinContact}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Upload Documents</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload any document in any of the following categories to fast track your loan application.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3">Supported documents:</h4>
            <ul className="space-y-2">
              {documents.map((doc, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b font-medium text-sm">
              <span>Document</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {documentTypes.map((docType) => {
              const document = documents.find((doc) => doc.type === docType.id);
              const status = document?.status || "PENDING";

              return (
                <div key={docType.id} className="grid grid-cols-3 gap-4 p-4 border-b last:border-b-0 items-center">
                  <div>
                    <span className="font-medium">{docType.name}</span>
                  </div>
                  <div>
                    <Badge className={getStatusColor(status)}>{getStatusText(status)}</Badge>
                  </div>
                  <div className="flex space-x-2">
                    {document && status === "UPLOADED" ? (
                      <Button variant="outline" size="sm" onClick={() => onViewDocument?.(document)}>
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleUploadClick(docType.id)}>
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div> */}
        </CardContent>
      </Card>
    </div>
  );
}
