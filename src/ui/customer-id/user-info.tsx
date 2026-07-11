import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, MapPin, User, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <p className="text-sm text-[#999]">{label}</p>
      <p className="max-w-55 text-right text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="size-4 text-primary" />}
      <h4 className="text-sm font-medium text-foreground">{children}</h4>
    </div>
  );
}

export function UserPayrollPaymentSection({
  payroll,
  paymentMethod,
}: Omit<CustomerPPI, "identity">) {
  if (!payroll && !paymentMethod) return null;

  return (
    <div className="space-y-4">
      {payroll && (
        <>
          <div className="space-y-3">
            <SectionHeading>Employment Details</SectionHeading>
            <Row label="IPPIS ID" value={payroll.userId} />
            <Row label="Command (Employer)" value={payroll.command} />
          </div>

          <Separator className="bg-[#F5F5F5]" />

          <div className="space-y-3">
            <SectionHeading>Grade &amp; Compensation</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <Row
                label="Grade"
                value={
                  <Badge variant="outline" className="text-xs">
                    {payroll.grade}
                  </Badge>
                }
              />
              <Row
                label="Step"
                value={
                  <Badge variant="outline" className="text-xs">
                    Step {payroll.step}
                  </Badge>
                }
              />
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-green-700">Net Pay</p>
                <p className="text-lg font-semibold text-green-800">
                  {formatCurrency(payroll.netPay)}
                </p>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-green-600">Employee Gross</p>
                <p className="text-xs text-green-600">
                  {formatCurrency(payroll.employeeGross)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {paymentMethod && (
        <>
          <Separator className="bg-[#F5F5F5]" />

          <div className="space-y-3">
            <SectionHeading icon={CreditCard}>Payment Method</SectionHeading>
            <Row label="Bank Name" value={paymentMethod.bankName} />
            <Row label="Account Name" value={paymentMethod.accountName} />
            <Row label="Account Number" value={paymentMethod.accountNumber} />
            <Row
              label="Last Updated"
              value={formatDate(paymentMethod.updatedAt, "PPP")}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function UserIdentitySection({ identity }: Pick<CustomerPPI, "identity">) {
  if (!identity) return null;

  const {
    dateOfBirth,
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
    <div className="space-y-4">
      <div className="space-y-3">
        <SectionHeading icon={User}>Personal Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Date of Birth" value={dateOfBirth} />
          <Row label="Gender" value={gender} />
          <Row label="Marital Status" value={maritalStatus} />
          <Row label="State" value={stateResidency} />
        </div>
      </div>

      <Separator className="bg-[#F5F5F5]" />

      <div className="space-y-3">
        <SectionHeading icon={MapPin}>Address Information</SectionHeading>
        <Row label="Residential Address" value={residencyAddress} />
        <Row label="Landmark/Bus Stop" value={landmarkOrBusStop} />
      </div>

      <Separator className="bg-[#F5F5F5]" />

      <div className="space-y-3">
        <SectionHeading icon={Users}>Next of Kin</SectionHeading>
        <Row label="Name" value={nextOfKinName} />
        <Row label="Contact" value={nextOfKinContact} />
        <Row label="Relationship" value={nextOfKinRelationship} />
        <Row label="Address" value={nextOfKinAddress} />
      </div>
    </div>
  );
}
