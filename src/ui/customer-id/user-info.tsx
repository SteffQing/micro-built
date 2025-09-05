import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Briefcase, DollarSign, CreditCard, Edit, Shield } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { customerPPI } from "@/lib/queries/admin/customer";
import { UserIdentitySkeleton, UserPayrollPaymentSkeleton } from "./skeletons/user-info";

function UserPayrollPaymentCard({ payroll, paymentMethod }: Omit<CustomerPPI, "identity">) {
  if (!paymentMethod || !payroll) return null;
  // Mask account number for security
  const maskedAccountNumber = paymentMethod.accountNumber.replace(/(\d{3})\d+(\d{4})/, "$1****$2");

  return (
    <Card className="w-full bg-background">
      <CardHeader className="p-0 py-3 mb-3">
        <div className="flex items-center gap-2 px-5">
          <Briefcase className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold">Payroll & Payment Information</CardTitle>
        </div>
        <Separator className="bg-[#F5F5F5]" />
      </CardHeader>

      <CardContent className="space-y-4 p-0 px-5">
        {/* Employment Details */}
        <div className="space-y-3">
          <h4 className="font-medium text-[#666666] text-sm">Employment Details</h4>

          <div className="space-y-3">
            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">IPPIS ID</p>
              <p className="font-medium text-[#333333] text-sm">{payroll.userId}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Employer</p>
              <p className="font-medium text-[#333333] text-sm text-right max-w-[200px]">{payroll.command}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex gap-2 justify-between">
                <p className="text-[#999999] text-sm font-normal">Command</p>
                <p className="font-medium text-[#333333] text-sm">{payroll.command}</p>
              </div>

              <div className="flex gap-2 justify-between">
                <p className="text-[#999999] text-sm font-normal">Force Number</p>
                <p className="font-medium text-[#333333] text-sm">{payroll.userId}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Grade & Compensation */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-[#666666] text-sm">Grade & Compensation</h4>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Grade</p>
              <Badge variant="outline" className="text-xs">
                {payroll.grade}
              </Badge>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Step</p>
              <Badge variant="outline" className="text-xs">
                Step {payroll.step}
              </Badge>
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex gap-2 justify-between items-center">
              <p className="text-green-700 text-sm font-medium">Net Pay</p>
              <p className="text-green-800 text-lg font-semibold">{formatCurrency(payroll.netPay)}</p>
            </div>
            <p className="text-green-600 text-xs mt-1">After deductions</p>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Payment Method */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-[#666666] text-sm">Payment Method</h4>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Bank Name</p>
              <p className="font-medium text-[#333333] text-sm">{paymentMethod.bankName}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Account Name</p>
              <p className="font-medium text-[#333333] text-sm text-right max-w-[200px]">{paymentMethod.accountName}</p>
            </div>

            <div className="flex gap-2 justify-between items-center">
              <p className="text-[#999999] text-sm font-normal">Account Number</p>
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3 text-green-600" />
                <p className="font-medium text-[#333333] text-sm">{maskedAccountNumber}</p>
              </div>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Last Updated</p>
              <p className="font-medium text-[#333333] text-sm">{formatDate(paymentMethod.updatedAt, "PPP")}</p>
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-[#8A0806] border-[#FFE1E0] hover:bg-[#FFE1E0] bg-transparent"
          >
            <Edit className="w-4 h-4 mr-2" />
            Update Payment Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UserIdentityCard({ identity }: Pick<CustomerPPI, "identity">) {
  if (!identity) return null;

  const {
    dateOfBirth,
    documents,
    gender,
    maritalStatus,
    residencyAddress,
    stateResidency,
    landmarkOrBusStop,
    nextOfKinName,
    nextOfKinContact,
    nextOfKinAddress,
    nextOfKinRelationship,
  } = identity;
  return (
    <Card className="w-full bg-background">
      <CardHeader className="p-0 py-3 mb-3">
        <div className="flex items-center gap-2 px-5">
          <User className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold">Identity Information</CardTitle>
        </div>
        <Separator className="bg-[#F5F5F5]" />
      </CardHeader>

      <CardContent className="space-y-4 p-0 px-5">
        {/* Personal Details */}
        <div className="space-y-3">
          <h4 className="font-medium text-[#666666] text-sm">Personal Details</h4>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Date of Birth</p>
              <p className="font-medium text-[#333333] text-sm">{dateOfBirth}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Gender</p>
              <p className="font-medium text-[#333333] text-sm">{gender}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Marital Status</p>
              <p className="font-medium text-[#333333] text-sm">{maritalStatus}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">State</p>
              <p className="font-medium text-[#333333] text-sm">{stateResidency}</p>
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-[#666666] text-sm">Address Information</h4>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Residential Address</p>
              <p className="font-medium text-[#333333] text-sm text-right max-w-[200px]">{residencyAddress}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Landmark/Bus Stop</p>
              <p className="font-medium text-[#333333] text-sm">{landmarkOrBusStop}</p>
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-[#666666] text-sm">Next of Kin</h4>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Name</p>
              <p className="font-medium text-[#333333] text-sm">{nextOfKinName}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Contact</p>
              <p className="font-medium text-[#333333] text-sm">{nextOfKinContact}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Relationship</p>
              <p className="font-medium text-[#333333] text-sm">{nextOfKinRelationship}</p>
            </div>

            <div className="flex gap-2 justify-between">
              <p className="text-[#999999] text-sm font-normal">Address</p>
              <p className="font-medium text-[#333333] text-sm text-right max-w-[200px]">{nextOfKinAddress}</p>
            </div>
          </div>
        </div>

        <Separator className="bg-[#F5F5F5]" />

        <div className="space-y-3">
          <h4 className="font-medium text-[#666666] text-sm">Documents</h4>
          <div className="flex flex-wrap gap-2">
            {documents.map((doc, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {doc}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UserInfo({ id }: { id: string }) {
  const { data, isLoading } = useQuery(customerPPI(id));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {isLoading ? (
        <>
          <UserIdentitySkeleton />
          <UserPayrollPaymentSkeleton />
        </>
      ) : data?.data ? (
        <>
          <UserIdentityCard identity={data.data.identity} />
          <UserPayrollPaymentCard payroll={data.data.payroll} paymentMethod={data.data.paymentMethod} />
        </>
      ) : null}
    </div>
  );
}
