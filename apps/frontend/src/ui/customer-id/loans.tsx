"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Icon,
  icons,
} from "@/components/icon";
import { formatDate } from "date-fns";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import { customerLoans } from "@/lib/queries/admin/customer";
import {
  ActiveLoansSkeleton,
  PendingApplicationsSkeleton,
} from "./skeletons/loans";
import { CashLoanModal, CommodityLoanModal } from "../modals";
import LoanTopupModal from "../modals/loan-topup";
import LiquidationRequestModal from "../modals/customer-actions/liquidation-request";
import TenureChangeModal from "../modals/tenure-change";
import { EmptyState } from "./empty-state";

const LOANS_PER_PAGE = 2;

function displayLoanDate(value: string | Date | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : formatDate(date, "d MMM, yyyy");
}

function DetailRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        {hint && (
          <Tooltip>
            <TooltipTrigger aria-label={`About ${label}`} className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <Icon icon={icons.info} size={14} className="cursor-pointer text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              <p>{hint}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="min-w-0 text-right text-sm font-medium tabular-nums text-foreground wrap-anywhere">
        {value}
      </p>
    </div>
  );
}

function ActiveLoans({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: ActiveLoanDto[];
}) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedSnap, setSelectedSnap] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const orderedActive = useMemo(
    () =>
      [...active].sort((a, b) => {
        const newestA = new Date(
          a.disbursementDate ?? a.createdAt,
        ).getTime();
        const newestB = new Date(
          b.disbursementDate ?? b.createdAt,
        ).getTime();
        return newestB - newestA;
      }),
    [active],
  );
  const totalOutstanding = active.reduce(
    (sum, loan) => sum + (loan.outstanding ?? 0),
    0,
  );

  useEffect(() => {
    if (!carouselApi) return;

    const syncCarouselState = () => {
      setSelectedSnap(carouselApi.selectedScrollSnap());
      setSnapCount(carouselApi.scrollSnapList().length);
    };

    syncCarouselState();
    carouselApi.on("select", syncCarouselState);
    carouselApi.on("reInit", syncCarouselState);

    return () => {
      carouselApi.off("select", syncCarouselState);
      carouselApi.off("reInit", syncCarouselState);
    };
  }, [carouselApi]);

  return (
    <Card className="h-full gap-0 bg-background p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground">Active Loans</h2>
          <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">
            {active.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {active.length > 0 && (
            <TenureChangeModal
              borrowerId={id}
              trigger={
                <Button size="sm" variant="outline">
                  Change tenure
                </Button>
              }
            />
          )}
          <LiquidationRequestModal
            userId={id}
            name={name}
            outstanding={totalOutstanding}
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/10 text-sm font-medium text-brand hover:bg-destructive/5 hover:text-brand"
              >
                Liquidate
              </Button>
            }
          />
          <LoanTopupModal
            userId={id}
            trigger={
              <Button
                size="sm"
                className="gap-1.5 btn-gradient text-sm font-medium text-primary-foreground"
              >
                <Icon icon={icons.plus} size={16} />
                Top-up Loan
              </Button>
            }
          />
        </div>
      </div>
      <Separator className="bg-border" />

      <div className="p-4 sm:p-5">
        {active.length === 0 ? (
          <EmptyState
            title="No active loans"
            description="This user has no active loan running."
            className="py-16"
          />
        ) : (
          <Carousel
            setApi={setCarouselApi}
            opts={{
              align: "start",
              containScroll: "trimSnaps",
              duration: 28,
              slidesToScroll: 1,
            }}
            className="w-full px-10"
            aria-label="Active loans ordered newest first"
          >
            <CarouselContent className="-ml-3 items-stretch">
              {orderedActive.map((loan) => (
                <CarouselItem
                  key={loan.id}
                  className="flex pl-3 md:basis-1/2"
                >
                  <div className="flex h-full w-full flex-col gap-4 rounded-lg border border-border p-4">
                    <DetailRow label="Loan ID" value={loan.id} />
                    <Separator className="bg-muted" />
                    <DetailRow
                      label="Loan date"
                      value={displayLoanDate(loan.createdAt)}
                    />
                    <DetailRow
                      label="Disbursement date"
                      value={displayLoanDate(loan.disbursementDate)}
                    />
                    <DetailRow
                      label="Loan Principal"
                      value={formatCurrency(loan.principal)}
                    />
                    <DetailRow
                      label="Category"
                      value={capitalize(loan.category.replace(/_/g, " "))}
                    />
                    <DetailRow
                      label="Original tenure"
                      value={`${loan.tenure} Months`}
                    />
                    <DetailRow
                      label="Repaid Amount"
                      value={formatCurrency(loan.repaid)}
                    />
                    <DetailRow
                      label="Balance"
                      value={formatCurrency(loan.outstanding)}
                      hint="Outstanding balance left to repay on this loan"
                    />
                    <Separator className="mt-auto bg-muted" />
                    <CashLoanModal
                      id={loan.id}
                      trigger={
                        <Button
                          variant="outline"
                          className="w-full border-destructive/10 bg-transparent text-sm font-normal text-brand hover:bg-destructive/5 hover:text-brand"
                        >
                          See Loan Details
                        </Button>
                      }
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0 border-destructive/10 bg-background text-brand shadow-sm hover:bg-destructive/5 hover:text-brand" />
            <CarouselNext className="right-0 border-destructive/10 bg-background text-brand shadow-sm hover:bg-destructive/5 hover:text-brand" />

            {snapCount > 1 && (
              <div
                className="flex justify-center gap-2 pt-5"
                aria-label="Choose active loan slide"
              >
                {Array.from({ length: snapCount }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Go to active loan slide ${index + 1}`}
                    aria-current={index === selectedSnap ? "true" : undefined}
                    onClick={() => carouselApi?.scrollTo(index)}
                    className={cn(
                      "size-2 rounded-full transition-all duration-200",
                      index === selectedSnap
                        ? "w-5 bg-brand"
                        : "bg-border hover:bg-border/70",
                    )}
                  />
                ))}
              </div>
            )}
          </Carousel>
        )}
      </div>
    </Card>
  );
}

export function PendingApplications({
  pending,
}: {
  pending: PendingLoanDto[];
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(pending.length / LOANS_PER_PAGE);
  const paginated = pending.slice(
    page * LOANS_PER_PAGE,
    page * LOANS_PER_PAGE + LOANS_PER_PAGE,
  );

  return (
    <Card className="flex h-full flex-col gap-0 bg-background p-0">
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">Loan Applications</h2>
          <span className="text-xs text-muted-foreground">{pending.length} total</span>
        </div>
      </div>
      <Separator className="bg-border" />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {pending.length === 0 ? (
          <EmptyState
            icon={icons.file}
            title="No pending loan applications"
            description="This user has no pending or approved loan applications."
            className="flex-1 py-16"
          />
        ) : (
          <div className="space-y-4">
            {paginated.map((application) => (
              <div
                key={application.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1">
                    <span className="h-1 w-6 rounded-[2px] bg-warning" />
                    <span className="h-1 w-6 rounded-[2px] bg-success/40" />
                    <span className="h-1 w-6 rounded-[2px] bg-destructive/30" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    {formatDate(application.date, "d MMM, yyyy")}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 text-sm text-muted-foreground wrap-anywhere">
                    {application.asset?.name ??
                      capitalize(application.category.replace(/_/g, " "))}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      application.status === "APPROVED"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning",
                    )}
                  >
                    {application.status === "APPROVED"
                      ? "Awaiting disbursement"
                      : "Pending review"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {application.kind === "TOPUP"
                    ? "Top-up advance"
                    : "Initial advance"}
                  {application.tenure ? ` · ${application.tenure} months` : ""}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="truncate text-lg font-semibold tabular-nums text-brand sm:text-xl">
                    {application.amount === null
                      ? "Amount set at approval"
                      : formatCurrency(application.amount)}
                  </p>
                  {application.recordType === "COMMODITY_REQUEST" ? (
                    <CommodityLoanModal id={application.detailsId} />
                  ) : (
                    <CashLoanModal
                      id={application.detailsId}
                      trigger={
                        <button
                          type="button"
                          className="flex shrink-0 cursor-pointer items-center gap-0.5 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground"
                        >
                          See loan details
                          <Icon icon={icons.chevronRight} size={16} />
                        </button>
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground disabled:opacity-40"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-border text-border-foreground">
              <Icon icon={icons.chevronLeft} size={14} />
            </span>
            Prev
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-0 text-brand hover:bg-transparent hover:text-brand disabled:opacity-40"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Icon icon={icons.chevronRight} size={14} />
            </span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function LoansWrapper({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const { data, isLoading } = useQuery(customerLoans(id));

  const activeLoans = data?.data?.activeLoans ?? [];
  const applications =
    data?.data?.applications ?? data?.data?.pendingLoans ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {isLoading ? (
          <ActiveLoansSkeleton />
        ) : (
          <ActiveLoans id={id} name={name} active={activeLoans} />
        )}
      </div>
      {isLoading ? (
        <PendingApplicationsSkeleton />
      ) : (
        <PendingApplications pending={applications} />
      )}
    </div>
  );
}
