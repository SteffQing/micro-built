"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function UserIdentitySection({
  gender,
  dateOfBirth,
  ...props
}: UserIdentityDto) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-semibold">
              User Identity
            </CardTitle>
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
              <Label className="text-sm text-muted-foreground">
                Date of Birth
              </Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{dateOfBirth}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                State of Residence
              </Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{props.stateResidency}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Residential Address
              </Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{props.residencyAddress}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Next of Kin
              </Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{props.nextOfKinName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Next of Kin Phone Number
              </Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <span className="font-medium">{props.nextOfKinContact}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
