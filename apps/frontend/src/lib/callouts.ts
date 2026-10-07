import { icons, type IconData } from "@/components/icon";

/**
 * What fits a callout card, which is always the same height: two lines of title, four of body, the figure on the
 * artwork. The API and the database hold it to the same limits.
 */
export const CALLOUT_LIMITS = { title: 60, body: 160, highlight: 24 } as const;

/** Every callout but the pinned one is deleted this long after it's created or last renewed. */
export const CALLOUT_LIFETIME_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left before a callout is deleted (0 on its last day); null while pinned. */
export function daysLeft(callout: Pick<Callout, "expiresAt">, now = Date.now()): number | null {
  if (!callout.expiresAt) return null;
  return Math.max(0, Math.floor((new Date(callout.expiresAt).getTime() - now) / DAY_MS));
}

/** "Deleted in 5 days", "Deleted tomorrow", "Deleted today". */
export function expiryLabel(days: number): string {
  if (days <= 0) return "Deleted today";
  if (days === 1) return "Deleted tomorrow";
  return `Deleted in ${days} days`;
}

/** How many callouts a viewer has at once (the API's limit too). */
export const CALLOUTS_PER_VIEWER = 3;

export const CALLOUT_KINDS: Record<CalloutKind, { label: string; icon: IconData; hint: string }> = {
  EDUCATION: { label: "Learn", icon: icons.book, hint: "How loans, deductions and repayments work" },
  INSIGHT: { label: "Insight", icon: icons.idea, hint: "A useful observation about money or borrowing" },
  PRODUCT: { label: "Product", icon: icons.rocket, hint: "What MicroBuilt offers, or something new in the app" },
  ANNOUNCEMENT: { label: "News", icon: icons.callouts, hint: "Something people should know about now" },
  STATISTIC: { label: "By the numbers", icon: icons.analytics, hint: "A figure that shows scale or trust" },
  BRAND: { label: "MicroBuilt", icon: icons.sparkles, hint: "Who we are and what we stand for" },
};

export const CALLOUT_KIND_ORDER = Object.keys(CALLOUT_KINDS) as CalloutKind[];

export const CALLOUT_AUDIENCES: { value: CalloutAudience; label: string }[] = [
  { value: "CUSTOMER", label: "Customers" },
  { value: "MARKETER", label: "Marketers" },
  { value: "ADMIN", label: "Admins" },
  { value: "SUPER_ADMIN", label: "Super admins" },
];

export const CALLOUT_PRIORITIES = [
  { value: 0, label: "Low" },
  { value: 1, label: "Normal" },
  { value: 2, label: "High" },
] as const;

/** What a role sees now, in the API's order: pinned, then priority, then the most recently published. */
export function liveFor(role: CalloutAudience, callouts: Callout[], now = Date.now()): Callout[] {
  return callouts
    .filter(
      (callout) =>
        callout.status === "PUBLISHED" &&
        callout.audience.includes(role) &&
        (callout.pinned || !callout.expiresAt || new Date(callout.expiresAt).getTime() > now),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.priority - a.priority ||
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
        a.id.localeCompare(b.id),
    )
    .slice(0, CALLOUTS_PER_VIEWER);
}

// Dismissing is this browser's business: the ids live in localStorage and go to the API only to be left out.
const DISMISSED_KEY = "mb.callouts.dismissed";
const TURN_KEY = "mb.callouts.turn";
const SESSION_KEY = "mb.callouts.session";
const MAX_DISMISSED = 60;

export function readDismissed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(-MAX_DISMISSED) : [];
  } catch {
    return [];
  }
}

export function saveDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-MAX_DISMISSED)));
  } catch {
    // Storage blocked: it stays dismissed until the page reloads.
  }
}

/**
 * Which turn of the rotation this visit is: it moves on once per browser session, so each visit opens on the next
 * callout rather than always the same one.
 */
export function readTurn(): number {
  try {
    let turn = Number(localStorage.getItem(TURN_KEY)) || 0;
    if (!sessionStorage.getItem(SESSION_KEY)) {
      turn += 1;
      localStorage.setItem(TURN_KEY, String(turn));
      sessionStorage.setItem(SESSION_KEY, "1");
    }
    return turn;
  } catch {
    return 0;
  }
}

/** Starting points for a new callout, one per kind. */
export const CALLOUT_EXAMPLES: (CalloutInput & { name: string })[] = [
  {
    name: "Paying early",
    kind: "EDUCATION",
    title: "Pay early, pay less",
    body: "A payment before your deduction lowers what you owe straight away, so the deductions after it are smaller.",
    audience: ["CUSTOMER"],
  },
  {
    name: "How deductions work",
    kind: "EDUCATION",
    title: "How your repayment is taken",
    body: "Each month your employer deducts your repayment from your salary and sends it to us. You don't need to transfer anything yourself.",
    audience: ["CUSTOMER"],
  },
  {
    name: "Borrowing within reach",
    kind: "INSIGHT",
    title: "Keep repayments within reach",
    body: "A loan whose monthly repayment stays well under your take-home pay is easier to carry, and leaves room for the unexpected.",
    audience: ["CUSTOMER", "MARKETER"],
  },
  {
    name: "Top-ups",
    kind: "PRODUCT",
    title: "Need a little more?",
    body: "With a running loan in good standing you can ask for a top-up. It joins your current loan, so you keep a single monthly repayment.",
    audience: ["CUSTOMER"],
  },
  {
    name: "Asset financing",
    kind: "PRODUCT",
    title: "Get the item, pay monthly",
    body: "Asset financing gets you an item from our catalogue now, and you repay it from your salary like any other loan.",
    audience: ["CUSTOMER", "MARKETER"],
  },
  {
    name: "Closing a month",
    kind: "ANNOUNCEMENT",
    title: "Close each month with its voucher",
    body: "Uploading an organization's voucher settles that month's deductions and locks its variation. Until then, the month's amounts can still change.",
    audience: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    name: "Customers served (put in your real figure)",
    kind: "STATISTIC",
    title: "Public servants we've financed",
    highlight: "1,000+",
    body: "Across ministries, agencies and the armed forces, people trust MicroBuilt to fund what matters to them and repay at a pace they can manage.",
    audience: ["CUSTOMER", "MARKETER", "ADMIN", "SUPER_ADMIN"],
  },
  {
    name: "Who we are",
    kind: "BRAND",
    title: "Built for public servants",
    body: "MicroBuilt Prime exists to give public servants fair credit: clear terms, repayments from salary, and people who answer when you call.",
    audience: ["CUSTOMER", "MARKETER", "ADMIN", "SUPER_ADMIN"],
  },
];
