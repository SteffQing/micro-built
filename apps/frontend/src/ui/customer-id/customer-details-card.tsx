"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDate, isValid } from "date-fns";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customerPPI } from "@/lib/queries/admin/customer";
import { capitalize } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { icons } from "@/components/icon";

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

/** Payroll, identity and payment details as tabs, each laid out across the full width. */
export default function CustomerDetailsCard({ id }: { id: string }) {
  const { data, isLoading } = useQuery(customerPPI(id));
  const payroll = data?.data?.payroll ?? null;
  const identity = data?.data?.identity ?? null;
  const payment = data?.data?.paymentMethod ?? null;

  return (
    <Card className="gap-0 overflow-hidden bg-background p-0">
      <Tabs defaultValue="payroll" className="gap-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <h2 className="font-semibold text-foreground">Customer Details</h2>
          <div className="max-w-full overflow-x-auto">
            <TabsList className="bg-muted">
              <TabsTrigger value="payroll">Payroll</TabsTrigger>
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="payment">Payment method</TabsTrigger>
            </TabsList>
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
                  <EmptyState icon={icons.file} title="No payroll data" description="This customer has no payroll record yet." className="py-8" />
                )}
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
                  <EmptyState icon={icons.user} title="No identity details" description="The customer hasn't added identity details yet." className="py-8" />
                )}
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
                  <EmptyState icon={icons.creditCard} title="No payment method" description="The customer hasn't added a bank account yet." className="py-8" />
                )}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </Card>
  );
}
