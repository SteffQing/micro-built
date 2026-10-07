import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupportAudience } from '@prisma/client';

// The assistant's knowledge (CHAT_SUPPORT.md §1.6): markdown in ./knowledge, copied to dist as Nest assets, read once
// and assembled per audience. It holds no rates, formulas or internal notes (knowledge.spec.ts checks).

export const KNOWLEDGE_DIR = join(__dirname, 'knowledge');

const FILES = {
  product: 'product.md',
  customerFaq: 'customer-faq.md',
  staffGuide: 'staff-guide.md',
  contact: 'contact.md',
} as const;

/** Marketer < admin < super admin: a staff-guide section is loaded for its role and the roles above it. */
const STAFF_RANK: Partial<Record<SupportAudience, number>> = { MARKETER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
const SECTION_MARK = /<!--\s*role:\s*([A-Z_]+)\s*-->/;

export const supportEmail = () => process.env.SUPPORT_EMAIL || 'support@microbuiltprime.com';

let cache: Record<keyof typeof FILES, string> | null = null;

export function readKnowledge(dir = KNOWLEDGE_DIR): Record<keyof typeof FILES, string> {
  return Object.fromEntries(
    Object.entries(FILES).map(([key, file]) => [key, readFileSync(join(dir, file), 'utf8').trim()]),
  ) as Record<keyof typeof FILES, string>;
}

/** The staff guide's intro plus the sections for `audience` and the roles below it. */
export function staffSections(guide: string, audience: SupportAudience): string {
  const rank = STAFF_RANK[audience] ?? 0;
  // Splitting on a pattern with a capture group alternates: [intro, role, body, role, body, …].
  const [intro, ...sections] = guide.split(SECTION_MARK);
  const kept = [intro.trim()];
  for (let i = 0; i < sections.length; i += 2) {
    const role = sections[i] as SupportAudience;
    if ((STAFF_RANK[role] ?? Infinity) <= rank) kept.push(sections[i + 1].trim());
  }
  return kept.join('\n\n');
}

/** The knowledge block of the system prompt for this audience. */
export function knowledgeFor(audience: SupportAudience, restricted: boolean): string {
  cache ??= readKnowledge();
  const parts = [cache.product];
  if (audience === 'ANONYMOUS' || audience === 'CUSTOMER') parts.push(cache.customerFaq);
  else parts.push(staffSections(cache.staffGuide, audience));
  if (restricted) {
    parts.push(
      '# This account\n\nThis account is restricted: either it is deactivated, or (for a super admin) two-factor ' +
        'authentication or a passkey still has to be set up. You cannot look anything up for it. The team can help: ' +
        'offer to pass the conversation to them.',
    );
  }
  parts.push(cache.contact.replaceAll('{{SUPPORT_EMAIL}}', supportEmail()));
  return parts.join('\n\n---\n\n');
}
