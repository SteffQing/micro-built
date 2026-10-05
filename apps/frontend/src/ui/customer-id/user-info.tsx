import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Icon, icons } from "@/components/icon";
import { formatDate } from "date-fns";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <p className="shrink-0 text-sm text-muted-foreground">{label}</p>
      <p className="min-w-0 max-w-55 wrap-break-word text-right text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  iconKey,
  children,
}: {
  iconKey?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {iconKey && <Icon icon={icons[iconKey]} size={16} className="text-primary" />}
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
            <Row label="IPPIS ID" value={payroll.externalId} />
            <Row label="Command (Employer)" value={payroll.command} />
            {payroll.organization && (
              <Row label="Organization" value={payroll.organization} />
            )}
          </div>

          <Separator className="bg-muted" />

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
          </div>
        </>
      )}

      {paymentMethod && (
        <>
          <Separator className="bg-muted" />

          <div className="space-y-3">
            <SectionHeading iconKey="creditCard">Payment Method</SectionHeading>
            <Row label="Bank Name" value={paymentMethod.bankName} />
            <Row label="Account Name" value={paymentMethod.accountName} />
            <Row label="Account Number" value={paymentMethod.accountNumber} />
            {paymentMethod.bvn && <Row label="BVN" value={paymentMethod.bvn} />}
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
        <SectionHeading iconKey="user">Personal Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Date of Birth" value={dateOfBirth} />
          <Row label="Gender" value={gender} />
          <Row label="Marital Status" value={maritalStatus} />
          <Row label="State" value={stateResidency} />
        </div>
      </div>

      <Separator className="bg-muted" />

      <div className="space-y-3">
        <SectionHeading iconKey="mapPin">Address Information</SectionHeading>
        <Row label="Residential Address" value={residencyAddress} />
        <Row label="Landmark/Bus Stop" value={landmarkOrBusStop} />
      </div>

      <Separator className="bg-muted" />

      <div className="space-y-3">
        <SectionHeading iconKey="userGroup">Next of Kin</SectionHeading>
        <Row label="Name" value={nextOfKinName} />
        <Row label="Contact" value={nextOfKinContact} />
        <Row label="Relationship" value={nextOfKinRelationship} />
        <Row label="Address" value={nextOfKinAddress} />
      </div>
    </div>
  );
}
