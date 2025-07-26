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
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  date: string;
  status: NotificationStatus;
  actionText?: string;
  actionUrl?: string;
  user?: {
    name: string;
    avatar: string;
  };
  amount?: string;
  loanId?: string;
}

interface NotificationCounts {
  all: number;
  loanRequests: number;
  repayments: number;
  unread: number;
  read: number;
}
