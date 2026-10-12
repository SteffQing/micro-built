import { SUPPORT_EMAIL, SUPPORT_HOURS } from "@/lib/support";

// Every public question and answer, kept in line with what the support assistant tells customers
// (apps/backend/src/support/knowledge). The /faq page shows them all and publishes them as FAQPage structured data;
// the home page shows the few in HOME_FAQ. Answers are plain text so they work in both.

export type Faq = { id: string; q: string; a: string };
export type FaqGroup = { id: string; title: string; items: Faq[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "applying",
    title: "Applying",
    items: [
      {
        id: "who-can-apply",
        q: "Who can apply?",
        a: "Salary earners whose pay MicroBuilt can deduct from through their employer's payroll, mostly public servants. When you sign up you add your employer and payroll details, and we confirm them before your first loan.",
      },
      {
        id: "what-you-need",
        q: "What do I need to apply?",
        a: "An email address or phone number to sign up, your employer and payroll details, your identity details and a bank account in your name for the money to be paid into. The team confirms these once, before your first loan.",
      },
      {
        id: "how-much",
        q: "How much can I borrow?",
        a: "It depends on your salary and on any loan you already have, because we keep your monthly deduction to a sensible share of your net pay. The repayment estimator on the home page shows what an amount costs each month, and your account officer can confirm what you qualify for.",
      },
      {
        id: "cash-loan-uses",
        q: "What can I use a cash loan for?",
        a: "Most things: education, rent, medical bills, business, travel, agriculture, utilities, emergencies or anything else. You choose the purpose and the amount when you apply, and the money is paid into your bank account.",
      },
      {
        id: "asset-financing",
        q: "How does asset financing work?",
        a: "Instead of cash, you ask for an item from our catalogue. The team reviews the request and, once it is approved, sets the amount and the number of months. You then repay it from your salary like a cash loan.",
      },
      {
        id: "approval-time",
        q: "How long does approval take?",
        a: "Our team reviews every request, and you're notified in the app as soon as yours is approved and again when the money is sent to your bank.",
      },
      {
        id: "edit-request",
        q: "Can I change or withdraw a request?",
        a: "Yes, while it is still pending. Open the Loans page in the app to edit or withdraw it. If a request is rejected, you can apply again.",
      },
    ],
  },
  {
    id: "costs-and-repayments",
    title: "Costs and repayments",
    items: [
      {
        id: "loan-cost",
        q: "What does a loan cost?",
        a: "A monthly interest rate on the amount you borrow, spread evenly over your deductions, plus a one-time management fee taken from the money we pay out. Every rate is shown before you confirm a request, and a running loan keeps the rates it was approved with. The repayment estimator on the home page uses today's rates.",
      },
      {
        id: "how-to-repay",
        q: "How do I repay?",
        a: "You don't have to do anything. A fixed amount comes off your salary each month until the loan is cleared, through your employer's payroll.",
      },
      {
        id: "deduction-timing",
        q: "When does a month's deduction show on my dashboard?",
        a: "Each month we send your employer's payroll the amount to deduct, and payroll sends back a record of what was actually deducted. Your dashboard updates when that record arrives, usually a few days to a few weeks after payday, depending on your employer.",
      },
      {
        id: "short-deduction",
        q: "What if a month's deduction falls short?",
        a: "If payroll deducts less than expected, or nothing (for example when salary is delayed), the amount that wasn't covered stays on your balance and a default charge is added on it, at the rate shown when you applied. You'll see it on your dashboard, and you can pay the shortfall yourself from the Repayments page so it doesn't grow.",
      },
      {
        id: "top-up",
        q: "Can I borrow more while a loan is running?",
        a: "Yes. Request a top-up of cash or an item from your dashboard. The team reviews it like a new request, and once it is paid out your balance and monthly deduction are worked out again, as one deduction.",
      },
      {
        id: "pay-off-early",
        q: "Can I pay off my loan early?",
        a: "Yes, in part or in full. On the Repayments page, choose Liquidate Loan to see how much clears your loan today, pay that amount (or part of it) to MicroBuilt's account and upload the proof of payment. The team checks it, usually within a working day, and the deductions after it are smaller.",
      },
      {
        id: "smaller-deduction",
        q: "Can I make my monthly deduction smaller?",
        a: "The team can change the number of months your loan runs for, which changes the monthly deduction. A change is proposed and approved by the team, and you're told when it takes effect.",
      },
      {
        id: "statement",
        q: "How do I get a loan statement?",
        a: "The Statement page in the app lists every charge and payment on your loan with a running balance. Choose Export statement for a PDF or a spreadsheet; it arrives in your notifications, and by email if you have one, with a download link.",
      },
    ],
  },
  {
    id: "account-and-security",
    title: "Your account and security",
    items: [
      {
        id: "sign-in",
        q: "How do I sign in?",
        a: "With your password, a code sent to your email, a magic link, or a passkey (your fingerprint or face). If you forget your password, choose Forgot password on the sign-in page.",
      },
      {
        id: "two-factor",
        q: "How do I turn on two-factor authentication?",
        a: "Go to Settings, then Security, and add an authenticator app. Keep your backup codes somewhere safe: they get you in if you lose your phone. If you have none, contact the team and they'll reset your sign-in after confirming it's you.",
      },
      {
        id: "change-details",
        q: "How do I change my bank account or personal details?",
        a: "Edit them in Settings and submit the change. It shows as pending until the team approves it, so nobody can change where your money goes without it being checked. You're notified either way.",
      },
      {
        id: "never-ask",
        q: "Will MicroBuilt ever ask for my password or sign-in codes?",
        a: "No. We will never ask for your password, one-time codes or backup codes by phone, email, chat or text. If someone does, don't share them, and let us know.",
      },
    ],
  },
  {
    id: "help",
    title: "Getting help",
    items: [
      {
        id: "contact",
        q: "How do I reach the team?",
        a: `Ask our assistant on the Help & support page at any time, and pass the conversation to the team when you need a person; they usually reply within one working day. You can also email ${SUPPORT_EMAIL}. Office hours are ${SUPPORT_HOURS}, except public holidays.`,
      },
    ],
  },
];

const byId = new Map(FAQ_GROUPS.flatMap((group) => group.items).map((item) => [item.id, item]));

/** The short list on the home page. */
export const HOME_FAQ: Faq[] = [
  "who-can-apply",
  "how-to-repay",
  "loan-cost",
  "short-deduction",
  "top-up",
  "approval-time",
].map((id) => {
  const item = byId.get(id);
  if (!item) throw new Error(`HOME_FAQ: no question "${id}"`);
  return item;
});

/** FAQPage structured data for every question. */
export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_GROUPS.flatMap((group) => group.items).map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
