import type { SupportAudience } from '@prisma/client';

// The empty chat's suggestion chips, per audience (C12). Every one is a question the assistant can answer for that
// audience with its knowledge and tools.
const SUGGESTIONS: Record<SupportAudience, string[]> = {
  ANONYMOUS: [
    'How do salary-backed loans work?',
    'Who can apply for a loan?',
    'How are repayments deducted?',
    'How do I contact the team?',
  ],
  CUSTOMER: [
    "What's my loan balance?",
    'When is my next deduction?',
    'Why was my deduction partial?',
    'How do I pay off my loan early?',
  ],
  MARKETER: [
    'How are my customers doing?',
    'Find a customer by name',
    "Show a customer's recent deductions",
    'How do I request a top-up for a customer?',
  ],
  ADMIN: [
    'Look up a customer',
    "Show a loan's details",
    "What's an organization's variation status?",
    'How do I revert a voucher?',
  ],
  SUPER_ADMIN: [
    'Look up a customer',
    "What's an organization's variation status?",
    'How do I mark a month No payroll?',
    'Where do I change the settings?',
  ],
};

/** A restricted caller has no account lookups, so only questions about the product and reaching the team. */
const RESTRICTED = ['Why is my account restricted?', 'How do I reach the team?', 'How do repayments work?'];

export function suggestionsFor(audience: SupportAudience, restricted: boolean): string[] {
  return restricted ? RESTRICTED : SUGGESTIONS[audience];
}
