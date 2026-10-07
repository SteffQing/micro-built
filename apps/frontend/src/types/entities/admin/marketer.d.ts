/** What a marketer can ask an admin to act on. */
type EscalationKind = "LOAN" | "ASSET_REQUEST" | "TOPUP";
/** Any admin decides; only a super admin disburses. */
type EscalationStage = "DECISION" | "DISBURSEMENT";

type EscalationState = {
  /** What it waits for; null once there is nothing left to escalate. */
  stage: EscalationStage | null;
  /** When the marketer last escalated it, at this stage. */
  lastEscalatedAt: string | null;
};

type MarketerCashLoanItemDto = CashLoanItemDto & EscalationState;
type MarketerAssetRequestItemDto = CommodityLoanItemDto & EscalationState;
type MarketerTopupItemDto = AdminTopupDto & EscalationState;

type WaitingItemDto = {
  kind: "CUSTOMER" | EscalationKind | "ORGANIZATION";
  id: string;
  title: string;
  detail: string;
  customer: BorrowerCustomerInLoansDto | null;
  since: string;
  escalation: EscalationKind | null;
  stage: EscalationStage | null;
  lastEscalatedAt: string | null;
};

type MarketerOverviewDto = { waiting: WaitingItemDto[] };

type MarketerAdminDto = { id: string; name: string; role: "ADMIN" | "SUPER_ADMIN" };

type EscalateInput = { kind: EscalationKind; id: string; adminId?: string; note?: string };
type EscalationResultDto = { sentTo: string[]; skipped: string[]; escalatedAt: string };

type MarketerRepaymentOverviewDto = {
  period: { ym: string; label: string };
  expected: number;
  collected: number;
  counts: Record<DeductionStatus, number>;
};
