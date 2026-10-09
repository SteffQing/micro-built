type CalloutKind = "EDUCATION" | "INSIGHT" | "PRODUCT" | "ANNOUNCEMENT" | "STATISTIC" | "BRAND";

type CalloutStatus = "DRAFT" | "PUBLISHED";

/** GET /callouts: what a signed-in customer's sidebar shows (callouts are for customers only). */
type ViewerCallout = {
  id: string;
  kind: CalloutKind;
  title: string;
  body: string;
  /** A figure or short phrase shown large, or null. */
  highlight: string | null;
  pinned: boolean;
};

/** GET /admin/callouts (SUPER_ADMIN). */
type Callout = ViewerCallout & {
  /** 0 low, 1 normal, 2 high. */
  priority: number;
  status: CalloutStatus;
  publishedAt: string | null;
  /** When it's deleted: 7 days after it was created or last renewed. Null while pinned (it stays). */
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type CalloutInput = {
  kind: CalloutKind;
  title: string;
  body: string;
  highlight?: string | null;
  priority?: number;
  status?: CalloutStatus;
  pinned?: boolean;
};
