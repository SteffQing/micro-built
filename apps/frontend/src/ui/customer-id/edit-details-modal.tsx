"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gender, MaritalStatus, Relationship } from "@/config/enums";
import {
  addCustomerPayroll,
  proposeCustomerIdentity,
  proposeCustomerPaymentMethod,
} from "@/lib/mutations/admin/customer";
import { cn } from "@/lib/utils";
import { OrganizationNamePicker } from "@/ui/organizations/organization-name-picker";

export type EditableKind = "PAYROLL" | "IDENTITY" | "PAYMENT_METHOD";

type FieldSpec = {
  key: string;
  label: string;
  type?: "text" | "digits" | "date" | "select";
  options?: readonly string[];
  optional?: boolean;
  /** Exact length for digit fields. */
  length?: number;
  wide?: boolean;
};

const FIELDS: Record<EditableKind, FieldSpec[]> = {
  PAYROLL: [
    { key: "externalId", label: "IPPIS number" },
    { key: "organization", label: "Organization" },
    { key: "command", label: "Command (employer)", wide: true },
    { key: "grade", label: "Grade", optional: true },
    { key: "step", label: "Step", type: "digits", optional: true },
  ],
  IDENTITY: [
    { key: "dateOfBirth", label: "Date of birth", type: "date" },
    { key: "gender", label: "Gender", type: "select", options: Object.values(Gender) },
    { key: "maritalStatus", label: "Marital status", type: "select", options: Object.values(MaritalStatus) },
    { key: "stateResidency", label: "State of residence" },
    { key: "residencyAddress", label: "Residential address", wide: true },
    { key: "landmarkOrBusStop", label: "Landmark / bus stop", wide: true },
    { key: "nextOfKinName", label: "Next of kin" },
    { key: "nextOfKinContact", label: "Next of kin phone" },
    { key: "nextOfKinRelationship", label: "Relationship", type: "select", options: Object.values(Relationship) },
    { key: "nextOfKinAddress", label: "Next of kin address", wide: true },
  ],
  PAYMENT_METHOD: [
    { key: "bankName", label: "Bank" },
    { key: "accountNumber", label: "Account number", type: "digits", length: 10 },
    { key: "accountName", label: "Account name", wide: true },
    { key: "bvn", label: "BVN", type: "digits", length: 11 },
  ],
};

const TITLES: Record<EditableKind, string> = {
  PAYROLL: "payroll details",
  IDENTITY: "identity details",
  PAYMENT_METHOD: "bank details",
};

type Values = Record<string, string>;

/**
 * An admin's change to a customer's payroll, identity or bank details. Sent as a proposal: a super admin other than
 * the proposer approves it, and the customer is told. With nothing on file every required field is needed.
 */
export function EditDetailsModal({
  customerId,
  customerName,
  kind,
  current,
  trigger,
}: {
  customerId: string;
  customerName: string;
  kind: EditableKind;
  /** The live record, or null when there is none (approving creates it). */
  current: Values | null;
  trigger: React.ReactNode;
}) {
  const creating = current === null;
  const fields = FIELDS[kind];
  const initial = () => Object.fromEntries(fields.map((f) => [f.key, current?.[f.key] ?? ""]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(initial);

  const payroll = useMutation(addCustomerPayroll(customerId));
  const identity = useMutation(proposeCustomerIdentity(customerId));
  const payment = useMutation(proposeCustomerPaymentMethod(customerId));
  const mutation = kind === "PAYROLL" ? payroll : kind === "IDENTITY" ? identity : payment;

  const invalid = (f: FieldSpec) => {
    const value = values[f.key]?.trim() ?? "";
    if (!value) return !f.optional && (creating || Boolean(current?.[f.key]));
    if (f.type === "digits") return f.length ? !new RegExp(`^\\d{${f.length}}$`).test(value) : !/^\d+$/.test(value);
    return false;
  };
  const changed = fields.filter((f) => (values[f.key]?.trim() ?? "") !== (current?.[f.key] ?? ""));
  const ready = changed.length > 0 && !fields.some(invalid);

  function submit() {
    // A change sends only what differs; a new record sends every field given.
    const send = (creating ? fields : changed).filter((f) => values[f.key]?.trim());
    const body: Record<string, string | number> = Object.fromEntries(
      send.map((f) => [f.key, f.key === "step" ? Number(values[f.key]) : values[f.key].trim()]),
    );
    (mutation.mutateAsync as (data: unknown) => Promise<unknown>)(body).then(() => setOpen(false), () => undefined);
  }

  const set = (key: string) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValues(initial());
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-lg sm:max-w-[520px]">
        <DialogHeader className="border-b">
          <DialogTitle>
            {creating ? "Add" : "Change"} {TITLES[kind]}
          </DialogTitle>
          <DialogDescription>
            For {customerName}. A super admin approves it before it applies, and {customerName.split(" ")[0]} is told.
          </DialogDescription>
        </DialogHeader>
        <form
          className={cn(dialogBodyClass, "pt-4")}
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) submit();
          }}
        >
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            {fields.map((f) => {
              const id = `edit-${kind}-${f.key}`;
              const value = values[f.key] ?? "";
              const error = value.trim() !== "" && invalid(f);
              return (
                <div key={f.key} className={cn("grid gap-1.5", f.wide && "min-[480px]:col-span-2")}>
                  <Label htmlFor={id} className="text-xs text-muted-foreground">
                    {f.label}
                    {f.optional && " (optional)"}
                  </Label>
                  {f.type === "select" ? (
                    <Select value={value} onValueChange={set(f.key)}>
                      <SelectTrigger id={id} className="h-9 w-full">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options!.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.type === "date" ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id={id}
                          type="button"
                          variant="outline"
                          className={cn("h-9 w-full justify-start font-normal", !value && "text-muted-foreground")}
                        >
                          {value ? format(new Date(value), "d MMM yyyy") : "Pick a date"}
                          <Icon icon={icons.calendar} size={16} className="ml-auto opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={value ? new Date(value) : undefined}
                          onSelect={(date) => set(f.key)(date ? format(date, "yyyy-MM-dd") : "")}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          captionLayout="dropdown"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  ) : f.key === "organization" ? (
                    <OrganizationNamePicker
                      id={id}
                      value={value}
                      onChange={set(f.key)}
                      className="h-9"
                      newHint="A new organization is added with this change: at once when a super admin approves it, otherwise waiting for one."
                    />
                  ) : (
                    <Input
                      id={id}
                      value={value}
                      onChange={(e) => set(f.key)(f.type === "digits" ? e.target.value.replace(/\D/g, "") : e.target.value)}
                      inputMode={f.type === "digits" ? "numeric" : undefined}
                      maxLength={f.length}
                      aria-invalid={error || undefined}
                      autoComplete="off"
                      className="h-9"
                    />
                  )}
                  {error && f.length && <p className="text-xs text-destructive">{f.length} digits</p>}
                </div>
              );
            })}
          </div>
          {kind === "PAYROLL" && (
            <p className="text-xs text-muted-foreground">
              Once on file, the organization only changes through a switch request, and the rest through vouchers.
            </p>
          )}
          <DialogFooter className="border-t pt-4">
            <Button type="submit" disabled={!ready} loading={mutation.isPending}>
              Send for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
