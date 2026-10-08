// Chat support (backend docs/CHAT_SUPPORT.md §2, V2_API_CHANGES.md "Chat support"). Mirrors the API's DTOs exactly.

type SupportAudience = "ANONYMOUS" | "CUSTOMER" | "MARKETER" | "ADMIN" | "SUPER_ADMIN";
type SupportStatus = "AI" | "HANDOFF" | "ASSIGNED" | "CLOSED";
type SupportRole = "USER" | "AI" | "STAFF" | "SYSTEM";
type SupportRating = "UP" | "DOWN";

type SupportSession = {
  enabled: boolean;
  audience: SupportAudience;
  restricted: boolean;
  firstName?: string;
  suggestions: string[];
  limits: { messageChars: number; remainingToday?: number };
  turnstileRequired: boolean;
  canHandoff: boolean;
};

type SupportConversation = {
  id: string;
  title: string;
  status: SupportStatus;
  audience: SupportAudience;
  handedOffAt: string | null;
  closedAt: string | null;
  lastMessageAt: string;
  createdAt: string;
};

type SupportConversationRow = {
  id: string;
  title: string;
  status: SupportStatus;
  lastMessageAt: string;
  unread: boolean;
};

type SupportMessage = {
  id: string;
  role: SupportRole;
  body: string;
  authorName?: string;
  /** Staff: their avatar, when they set one. */
  authorImage?: string;
  rating?: SupportRating | null;
  offerHandoff: boolean;
  createdAt: string;
};

type SupportThread = {
  conversation: SupportConversation;
  messages: SupportMessage[];
};

type SupportHandoffInput = { contactName?: string; contactEmail?: string; contactPhone?: string; note?: string };

/** The `data-support` part that closes every streamed reply. */
type SupportReplyData = { messageId: string; offerHandoff: boolean };

// Staff (/admin/support)

type StaffSupportRequester = { name?: string; role?: string; link?: string; contact?: string };

type StaffSupportRow = {
  id: string;
  title: string;
  status: SupportStatus;
  requester: StaffSupportRequester;
  assignee: { id: string; name: string } | null;
  handedOffAt: string | null;
  lastMessageAt: string;
  unread: boolean;
};

type StaffSupportMessage = SupportMessage & { toolNames: string[] };

type StaffSupportThread = {
  conversation: SupportConversation & {
    assignee: { id: string; name: string } | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  requester: StaffSupportRequester;
  messages: StaffSupportMessage[];
};

type StaffSupportQuery = { status?: SupportStatus; assignee?: "me"; q?: string; page?: number };

type SupportAnalytics = {
  perDay: { day: string; conversations: number; messages: number; handoffs: number }[];
  handoffRate: number;
  ratings: { up: number; down: number };
  byProvider: { provider: string; model: string; replies: number }[];
  canned: { refusal: number; offTopic: number; eligibility: number; busy: number };
  quotaHits: { provider: string; count: number }[];
};
