"use client";

import type React from "react";
import { Fragment, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { OnboardCustomerType } from "./schema";
import { cn } from "@/lib/utils";
import { useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function formatTitle(val?: string | number | null) {
  if (val === null || val === undefined) return "";
  return String(val);
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="rounded-md border p-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}) {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    return null;
  }
  return (
    <div className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium text-foreground text-right",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}

interface Props {
  checked: boolean;
  setChecked: React.Dispatch<React.SetStateAction<boolean>>;
}
export default function CustomerPreviewDialog({ checked, setChecked }: Props) {
  const { getValues } = useFormContext<OnboardCustomerType>();

  const values = getValues();

  const dob = useMemo(() => {
    const s = values.identity?.dateOfBirth;
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString();
  }, [values.identity?.dateOfBirth]);

  const hasLoan = Boolean(values.loan);
  const loanCategory = values.loan?.category;
  const cash = values.loan?.cashLoan;
  const commodity = values.loan?.commodityLoan;

  const email = values.user?.email;
  const contact = values.user?.contact;

  return (
    <div className="flex flex-col gap-2">
      <h2>Preview Customer Details</h2>
      <div className="space-y-5 p-4 sm:p-5">
        <Section title="User">
          <Field label="Name" value={formatTitle(values.user?.name)} />
          <Field label="Email" value={email} mono />
          <Field label="Phone" value={contact} mono />
        </Section>

        <Section title="Identity">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-muted-foreground">Gender</span>
            <Badge variant="secondary" className="text-xs">
              {formatTitle(values.identity?.gender)}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-muted-foreground">
              Marital status
            </span>
            <Badge variant="secondary" className="text-xs">
              {formatTitle(values.identity?.maritalStatus)}
            </Badge>
          </div>
          <Field label="Date of birth" value={dob} />
          <Field
            label="Residency address"
            value={formatTitle(values.identity?.residencyAddress)}
          />
          <Field
            label="State of residency"
            value={formatTitle(values.identity?.stateResidency)}
          />
          <Field
            label="Landmark / Bus stop"
            value={formatTitle(values.identity?.landmarkOrBusStop)}
          />
          <Separator />
          <Field
            label="Next of kin name"
            value={formatTitle(values.identity?.nextOfKinName)}
          />
          <Field
            label="Next of kin phone"
            value={values.identity?.nextOfKinContact}
            mono
          />
          <Field
            label="Next of kin address"
            value={formatTitle(values.identity?.nextOfKinAddress)}
          />
          <Field
            label="Relationship"
            value={formatTitle(values.identity?.nextOfKinRelationship)}
          />
        </Section>

        <Section title="Payment method">
          <Field
            label="Bank name"
            value={formatTitle(values.paymentMethod?.bankName)}
          />
          <Field
            label="Account name"
            value={formatTitle(values.paymentMethod?.accountName)}
          />
          <Field
            label="Account number"
            value={formatTitle(values.paymentMethod?.accountNumber)}
            mono
          />
        </Section>

        <Section title="Payroll">
          <Field
            label="External ID"
            value={formatTitle(values.payroll?.externalId)}
            mono
          />
          <Field label="Grade" value={formatTitle(values.payroll?.grade)} />
          <Field label="Step" value={formatTitle(values.payroll?.step)} mono />
          <Field label="Command" value={formatTitle(values.payroll?.command)} />
        </Section>

        {hasLoan ? (
          <Section title="Loan">
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Category</span>
              <Badge variant="outline" className="text-xs">
                {formatTitle(loanCategory as string)}
              </Badge>
            </div>
            {cash ? (
              <Fragment>
                <Field label="Amount" value={formatTitle(cash.amount)} mono />
                <Field label="Tenure" value={formatTitle(cash.tenure)} mono />
              </Fragment>
            ) : null}
            {commodity ? (
              <Fragment>
                <Field
                  label="Asset name"
                  value={formatTitle(commodity.assetName)}
                />
              </Fragment>
            ) : null}
          </Section>
        ) : null}
      </div>

      <div className="flex gap-3 items-center">
        <Checkbox
          id="confirmation"
          checked={checked}
          onCheckedChange={(checked) => setChecked(checked === true)}
        />
        <Label
          htmlFor="confirmation"
          className="text-[#999999] font-normal text-sm"
        >
          I confirm that the details above are accurate
        </Label>
      </div>
    </div>
  );
}
