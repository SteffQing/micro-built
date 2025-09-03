type NotificationType =
  | "loan_request"
  | "repayment"
  | "loan_approval"
  | "loan_rejection"
  | "loan_disbursement"
  | "overdue_repayment"
  | "loan_tenure";

type NotificationStatus = "read" | "unread";

interface Notification {
  id: string;
  title: string;
  description: string;
  date: Date;
  callToActionUrl: string | null;
  userId: string | null;
  isRead: boolean;
}

interface NotificationCounts {
  all: number;
  loanRequests: number;
  repayments: number;
  unread: number;
  read: number;
}
