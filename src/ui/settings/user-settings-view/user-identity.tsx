import { Edit2, Upload, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function UserIdentity() {
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

          <Button variant="destructive" size="sm">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Details
          </Button>
        </div>

        {/* Identity Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Input
              id="gender"
              defaultValue="Female"
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              defaultValue="21 July, 1990"
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State of Residence</Label>
            <Input
              id="state"
              defaultValue="Lagos"
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Residential Address</Label>
            <Input
              id="address"
              defaultValue="12A Shonibare Street, Ikeja Lagos."
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextOfKin">Next of Kin</Label>
            <Input
              id="nextOfKin"
              defaultValue="Jasmine Cole"
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kinPhone">Next of Kin Phone Number</Label>
            <Input
              id="kinPhone"
              defaultValue="+234-8134568058"
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>

        {/* Upload Documents */}
        <div>
          <h4 className="text-base font-medium text-gray-900 mb-2">
            Upload Documents
          </h4>
          <p className="text-gray-600 mb-4">
            Upload any document in any of the following categories to fast track
            your loan application.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="font-medium text-gray-900 mb-2">
              Supported documents:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                • National ID (NIN), Driver's License, Passport, Voter's Card,
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
                  <Badge className="bg-green-100 text-green-700 w-fit">
                    Uploaded
                  </Badge>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-gray-900">Utility Bill</span>
                  <Badge className="bg-orange-100 text-orange-700 w-fit">
                    Pending
                  </Badge>
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
