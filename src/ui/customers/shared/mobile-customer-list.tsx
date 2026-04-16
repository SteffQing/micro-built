"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import UserAvatarComponent from "@/ui/settings/user-settings-view/user-avatar";

interface Props {
  customers: CustomerListItemDto[];
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription: string;
}

export default function MobileCustomerList({
  customers,
  isLoading,
  emptyTitle,
  emptyDescription,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-[#F0F0F0] bg-white p-4"
          >
            <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!customers.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#E0E0E0] bg-white p-5 text-center md:hidden">
        <h3 className="text-sm font-semibold text-[#333333]">{emptyTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      {customers.map((customer) => (
        <div
          key={customer.id}
          className="rounded-xl border border-[#F0F0F0] bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatarComponent
                id={customer.id}
                name={customer.name}
                className="h-10 w-10 shrink-0"
              />
              <div className="min-w-0">
                <h3 className="truncate font-medium text-[#333333]">
                  {customer.name}
                </h3>
                <p className="truncate text-sm text-muted-foreground">
                  {customer.contact ?? customer.email}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "shrink-0 rounded-[4px] px-[10px] py-1",
                getUserStatusColor(customer.status)
              )}
            >
              <p className="text-xs font-normal">
                {getUserStatusText(customer.status)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Customer ID</p>
              <p className="mt-1 break-all font-medium text-green-600">
                {customer.id}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Repayment Rate</p>
              <p className="mt-1 font-medium text-[#333333]">
                {customer.repaymentRate}%
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href={`/customers/${customer.id}`}
              className="inline-flex w-full items-center justify-center rounded-[4px] border border-[#E0E0E0] px-3 py-2 text-sm font-normal text-[#666666]"
            >
              View Customer
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
