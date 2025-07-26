import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function UserIdentitySkeleton() {
  return (
    <Card className="w-full bg-background">
      <CardHeader className="p-0 py-3 mb-3">
        <div className="flex items-center gap-2 px-5">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Separator className="bg-[#F5F5F5]" />
      </CardHeader>

      <CardContent className="space-y-4 p-0 px-5">
        {/* Personal Details Section */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />

          <div className="grid gap-3 md:grid-cols-2">
            {/* Date of Birth */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Gender */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Marital Status */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>

            {/* State */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Address Information Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-4 w-36" />
          </div>

          <div className="space-y-3">
            {/* Residential Address */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>

            {/* Landmark */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Next of Kin Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-4 w-24" />
          </div>

          <div className="space-y-3">
            {/* Name */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Contact */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>

            {/* Relationship */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>

            {/* Address */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Documents Section */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-18" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export function UserPayrollPaymentSkeleton() {
  return (
    <Card className="w-full bg-background">
      <CardHeader className="p-0 py-3 mb-3">
        <div className="flex items-center gap-2 px-5">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="h-6 w-52" />
        </div>
        <Separator className="bg-[#F5F5F5]" />
      </CardHeader>

      <CardContent className="space-y-4 p-0 px-5">
        {/* Employment Details Section */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />

          <div className="space-y-3">
            {/* IPPIS ID */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Employer */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-48" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {/* Command */}
              <div className="flex gap-2 justify-between">
                <Skeleton className="h-4 w-18" />
                <Skeleton className="h-4 w-32" />
              </div>

              {/* Force Number */}
              <div className="flex gap-2 justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Grade & Compensation Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-4 w-40" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {/* Grade */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-16" />
            </div>

            {/* Step */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>

          {/* Net Pay Card */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex gap-2 justify-between items-center">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-3 w-20 mt-1" />
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Payment Method Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-4 w-32" />
          </div>

          <div className="space-y-3">
            {/* Bank Name */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Account Name */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>

            {/* Account Number */}
            <div className="flex gap-2 justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            {/* Last Updated */}
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Actions Section */}
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}
