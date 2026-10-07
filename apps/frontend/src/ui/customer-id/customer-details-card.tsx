"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { adminChangeRequests } from "@/lib/queries/admin/change-requests";
import { useUserProvider } from "@/store/auth";
import { EditDetailsModal } from "./edit-details-modal";
import { formatDate, isValid } from "date-fns";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customerPPI } from "@/lib/queries/admin/customer";
import { capitalize } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { Icon, icons } from "@/components/icon";
import { SwitchOrganizationDialog } from "@/ui/organizations/switch-organization";

type Field = { label: string; value: React.ReactNode; wide?: boolean };

const show = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "—" : value;
// updatedAt can arrive empty or malformed; formatting an invalid Date throws and takes the page down.
const day = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && isValid(date) ? formatDate(date, "d MMM yyyy") : "—";
};
const words = (value: string | null | undefined) => (value ? capitalize(value.toLowerCase().replace(/_/g, " ")) : "—");

/** Label-over-value pairs in a grid that fills the card's width instead of leaving a column of whitespace. */
function FieldGrid({ fields }: { fields: Field[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
      {fields.map((field) => (
        <div key={field.label} className={field.wide ? "min-w-0 min-[480px]:col-span-2" : "min-w-0"}>
          <dt className="text-xs text-muted-foreground">{field.label}</dt>
          <dd className="mt-1 text-sm font-medium text-foreground wrap-anywhere">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <FieldGrid fields={fields} />
    </section>
  );
}

const KIND_FOR_TAB = { payroll: "PAYROLL", identity: "IDENTITY", payment: "PAYMENT_METHOD" } as const;

/** A proposal waiting on this tab's details, linking to it on Approvals. */
function PendingLine({ request }: { request: ChangeRequestDto }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <Icon icon={icons.calendarClock} size={16} className="shrink-0 text-warning" />
        <span className="min-w-0">
          {request.kind === "ORGANIZATION" && request.proposed.organization
            ? `A move to ${request.proposed.organization} is waiting for approval`
            : "A change is waiting for approval"}
          <span className="text-muted-foreground">
            {" "}
            · {request.requestedBy ? `proposed by ${request.requestedBy.name}` : "asked by the customer"}
          </span>
        </span>
      </span>
      <Link href={`/approvals?request=${request.id}`} className="text-xs font-medium text-brand hover:underline">
        Review
      </Link>
    </div>
  );
}

/** Payroll, identity and payment details as tabs, each laid out across the full width. */
export default function CustomerDetailsCard({ id, name }: { id: string; name: string }) {
  const { data, isLoading } = useQuery(customerPPI(id));
  const payroll = data?.data?.payroll ?? null;
  const identity = data?.data?.identity ?? null;
  const payment = data?.data?.paymentMethod ?? null;
  const { userRole } = useUserProvider();
  // Admins propose changes; a super admin approves them (marketers only read).
  const canPropose = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  const [tab, setTab] = useState<keyof typeof KIND_FOR_TAB>("payroll");
  const pending = useQuery({
    ...adminChangeRequests({ userId: id, status: "PENDING", limit: 10 }),
    enabled: canPropose,
    retry: false,
  });
  // The payroll tab also holds a pending change of organization.
  const pendingFor = (tabKey: keyof typeof KIND_FOR_TAB) =>
    pending.data?.data?.find(
      (r) => r.kind === KIND_FOR_TAB[tabKey] || (tabKey === "payroll" && r.kind === "ORGANIZATION"),
    ) ?? null;

  const current: Record<keyof typeof KIND_FOR_TAB, Record<string, string> | null> = {
    payroll: null,
    identity: identity
      ? {
          dateOfBirth: identity.dateOfBirth ? String(identity.dateOfBirth).slice(0, 10) : "",
          gender: identity.gender ?? "",
          maritalStatus: identity.maritalStatus ?? "",
          stateResidency: identity.stateResidency ?? "",
          residencyAddress: identity.residencyAddress ?? "",
          landmarkOrBusStop: identity.landmarkOrBusStop ?? "",
          nextOfKinName: identity.nextOfKinName ?? "",
          nextOfKinContact: identity.nextOfKinContact ?? "",
          nextOfKinRelationship: identity.nextOfKinRelationship ?? "",
          nextOfKinAddress: identity.nextOfKinAddress ?? "",
        }
      : null,
    payment: payment
      ? {
          bankName: payment.bankName ?? "",
          accountNumber: payment.accountNumber ?? "",
          accountName: payment.accountName ?? "",
          bvn: payment.bvn ?? "",
        }
      : null,
  };
  const onFile = { payroll: Boolean(payroll), identity: Boolean(identity), payment: Boolean(payment) };
  // Payroll is only proposed while there is none; afterwards the organization changes through a switch request and the
  // rest through vouchers.
  const editable = canPropose && !isLoading && !(tab === "payroll" && payroll) && !pendingFor(tab);
  const canSwitch = canPropose && !isLoading && tab === "payroll" && Boolean(payroll?.externalId) && !pendingFor("payroll");

  return (
    <Card className="gap-0 overflow-hidden bg-background p-0">
      <Tabs value={tab} onValueChange={(v) => setTab(v as keyof typeof KIND_FOR_TAB)} className="gap-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <h2 className="font-semibold text-foreground">Customer Details</h2>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className="max-w-full overflow-x-auto">
              <TabsList className="bg-muted">
                <TabsTrigger value="payroll">Payroll</TabsTrigger>
                <TabsTrigger value="identity">Identity</TabsTrigger>
                <TabsTrigger value="payment">Payment method</TabsTrigger>
              </TabsList>
            </div>
            {canSwitch && payroll && (
              <SwitchOrganizationDialog
                externalId={payroll.externalId}
                customerName={name}
                currentOrganizationId={payroll.organizationId}
                currentOrganization={payroll.organization}
                trigger={
                  <Button size="sm" variant="outline" className="h-9 gap-1.5">
                    <Icon icon={icons.building} size={14} />
                    Switch organization
                  </Button>
                }
              />
            )}
            {editable && (
              <EditDetailsModal
                key={tab}
                customerId={id}
                customerName={name}
                kind={KIND_FOR_TAB[tab]}
                current={current[tab]}
                trigger={
                  <Button size="sm" variant="outline" className="h-9 gap-1.5">
                    <Icon icon={onFile[tab] ? icons.edit : icons.plus} size={14} />
                    {onFile[tab] ? "Change" : "Add"}
                  </Button>
                }
              />
            )}
          </div>
        </div>
        <Separator className="bg-border" />

        <div className="p-4 sm:p-5">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="payroll" className="mt-0">
                {payroll ? (
                  <FieldGrid
                    fields={[
                      { label: "IPPIS ID", value: show(payroll.externalId) },
                      { label: "Command (Employer)", value: show(payroll.command) },
                      { label: "Grade", value: show(payroll.grade) },
                      { label: "Step", value: payroll.step ? `Step ${payroll.step}` : "—" },
                      ...(payroll.organization ? [{ label: "Organization", value: payroll.organization, wide: true }] : []),
                    ]}
                  />
                ) : (
                  <EmptyState
                    icon={icons.fileSpreadsheet}
                    title="No payroll data"
                    description="Add it so loans can be approved; afterwards the organization changes through a switch request and the rest through vouchers."
                    className="py-8"
                  />
                )}
                {pendingFor("payroll") && <PendingLine request={pendingFor("payroll")!} />}
              </TabsContent>

              <TabsContent value="identity" className="mt-0">
                {identity ? (
                  <div className="space-y-6">
                    <Section
                      title="Personal"
                      fields={[
                        { label: "Date of birth", value: show(identity.dateOfBirth) },
                        { label: "Gender", value: words(identity.gender) },
                        { label: "Marital status", value: words(identity.maritalStatus) },
                        { label: "State of residence", value: show(identity.stateResidency) },
                        { label: "Residential address", value: show(identity.residencyAddress), wide: true },
                        { label: "Landmark / bus stop", value: show(identity.landmarkOrBusStop), wide: true },
                      ]}
                    />
                    <Section
                      title="Next of kin"
                      fields={[
                        { label: "Name", value: show(identity.nextOfKinName) },
                        { label: "Contact", value: show(identity.nextOfKinContact) },
                        { label: "Relationship", value: words(identity.nextOfKinRelationship) },
                        { label: "Address", value: show(identity.nextOfKinAddress) },
                      ]}
                    />
                  </div>
                ) : (
                  <EmptyState icon={icons.user} title="No identity details" description="Not added yet. Add them here or the customer can in their settings." className="py-8" />
                )}
                {pendingFor("identity") && <PendingLine request={pendingFor("identity")!} />}
              </TabsContent>

              <TabsContent value="payment" className="mt-0">
                {payment ? (
                  <FieldGrid
                    fields={[
                      { label: "Bank", value: show(payment.bankName) },
                      { label: "Account name", value: show(payment.accountName) },
                      { label: "Account number", value: <span className="tabular-nums">{show(payment.accountNumber)}</span> },
                      ...(payment.bvn ? [{ label: "BVN", value: <span className="tabular-nums">{payment.bvn}</span> }] : []),
                      { label: "Last updated", value: day(payment.updatedAt) },
                    ]}
                  />
                ) : (
                  <EmptyState icon={icons.creditCard} title="No payment method" description="Not added yet. Add it here or the customer can in their settings." className="py-8" />
                )}
                {pendingFor("payment") && <PendingLine request={pendingFor("payment")!} />}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </Card>
  );
}
