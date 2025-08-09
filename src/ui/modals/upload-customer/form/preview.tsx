"use client";

import type React from "react";

import { Fragment, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { OnboardCustomerType } from "../schema";
import { cn } from "@/lib/utils";
import { ExternalLink, FileText, ImageIcon, LinkIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";

function formatTitle(val?: string | number | null) {
  if (val === null || val === undefined) return "";
  return String(val);
}

function maskPhone(phone?: string | null) {
  if (!phone) return "";
  if (phone.length < 4) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function isTruthyString(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
}
function isPdfUrl(url: string) {
  return /\.pdf$/i.test(url);
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

export default function CustomerPreviewDialog() {
  const { getValues } = useFormContext<OnboardCustomerType>();

  const values = getValues();

  const docUrl = values.identity?.documents?.[0];

  const dob = useMemo(() => {
    const s = values.identity?.dateOfBirth;
    if (!isTruthyString(s)) return "";
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
    <ScrollArea className="max-h-[70vh]">
      <div className="space-y-5 p-4 sm:p-5">
        <Section title="User">
          <Field label="Name" value={formatTitle(values.user?.name)} />
          <Field
            label="Email"
            value={isTruthyString(email) ? email : undefined}
            mono
          />
          <Field
            label="Phone"
            value={isTruthyString(contact) ? maskPhone(contact) : undefined}
            mono
          />
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
            value={maskPhone(values.identity?.nextOfKinContact)}
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
          {isTruthyString(docUrl) ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Document</span>
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-4"
                  aria-label="Open uploaded document in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {"Open"}
                </a>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                {isImageUrl(docUrl) ? (
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs underline underline-offset-4"
                    >
                      {docUrl}
                    </a>
                  </div>
                ) : isPdfUrl(docUrl) ? (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs underline underline-offset-4"
                    >
                      {docUrl}
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs underline underline-offset-4"
                    >
                      {docUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : null}
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
          <Field
            label="Employee gross"
            value={formatTitle(values.payroll?.employeeGross)}
            mono
          />
          <Field
            label="Net pay"
            value={formatTitle(values.payroll?.netPay)}
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
                {formatTitle(loanCategory as LoanCategory)}
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
                <Field
                  label="Public details"
                  value={formatTitle(commodity.publicDetails)}
                />
                <Field
                  label="Private details"
                  value={formatTitle(commodity.privateDetails)}
                />
                <Field
                  label="Amount"
                  value={formatTitle(commodity.amount)}
                  mono
                />
                <Field
                  label="Tenure"
                  value={formatTitle(commodity.tenure)}
                  mono
                />
                <Field
                  label="Management fee rate"
                  value={`${formatTitle(commodity.managementFeeRate)}%`}
                  mono
                />
              </Fragment>
            ) : null}
          </Section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
