import { supportEmail } from './knowledge';

// Fixed replies the server sends without calling a model (CHAT_SUPPORT.md C4, C8), in English and Nigerian Pidgin.

export type CannedKind = 'refusal' | 'off_topic' | 'eligibility' | 'busy' | 'handed_off';

export interface CannedReply {
  kind: CannedKind;
  body: string;
  offerHandoff: boolean;
}

// Words that, together, mark a message as Pidgin. Two hits are needed so English with one loan word stays English.
const PIDGIN = /\b(abeg|wetin|dey|una|wahala|abi|sabi|oya|comot|wan|don|na im|no be|e be|make i|how far|oga|shey|sef|dem|mumu|kpele|ehn)\b/gi;

export const isPidgin = (text: string) => (text.match(PIDGIN) ?? []).length >= 2;

const COPY: Record<CannedKind, { en: (email: string) => string; pcm: (email: string) => string }> = {
  refusal: {
    en: () =>
      "I can't help with that. I can answer questions about MicroBuilt Prime and, when you're signed in, about your own " +
      'account. What would you like to know?',
    pcm: () =>
      'I no fit help with dat one. I fit answer question about MicroBuilt Prime and, when you don sign in, about your ' +
      'own account. Wetin you wan know?',
  },
  off_topic: {
    en: () =>
      "I'm MicroBuilt's support assistant, so I can only help with MicroBuilt Prime: loans, repayments, your account " +
      'and how to use the app. What can I help you with?',
    pcm: () =>
      'Na MicroBuilt support I be, so na only MicroBuilt Prime matter I fit help with: loan, repayment, your account and ' +
      'how to use the app. Wetin I fit do for you?',
  },
  eligibility: {
    en: () =>
      'To get a loan you need to be a salary earner whose employer’s payroll MicroBuilt can deduct from, with a bank ' +
      'account in your name and your identity details. What you can borrow depends on your salary and any loan you ' +
      'already have, so your account officer can confirm what you qualify for.',
    pcm: () =>
      'To collect loan, you suppose dey collect salary wey MicroBuilt fit deduct from through your employer payroll, ' +
      'get bank account for your name and your identity details. How much you fit borrow depend on your salary and any ' +
      'loan wey you don get, so your account officer go confirm wetin you qualify for.',
  },
  busy: {
    en: (email) =>
      "I'm getting a lot of questions right now and can't answer this one. I can pass this conversation to the team " +
      `and they'll reply here, or you can email ${email}.`,
    pcm: (email) =>
      `Plenty people dey ask question now, so I no fit answer dis one. I fit pass dis conversation give the team make ` +
      `dem reply you here, or you fit email ${email}.`,
  },
  handed_off: {
    en: () => "Thanks, it's with the team now. They'll reply here, and by email, usually within one working day.",
    pcm: () => 'Thank you, e don reach the team. Dem go reply you here and for email, usually inside one working day.',
  },
};

/** Busy and the eligibility answer offer the team; a refusal or redirect doesn't (the caller can ask something else). */
const OFFERS_HANDOFF: Record<CannedKind, boolean> = {
  refusal: false,
  off_topic: false,
  eligibility: true,
  busy: true,
  handed_off: false,
};

export function canned(kind: CannedKind, userText = '', handoffAllowed = true): CannedReply {
  const pidgin = isPidgin(userText);
  if (kind === 'busy' && !handoffAllowed) {
    // Staff answer support themselves: there is no team to pass it to.
    const body = pidgin
      ? 'Plenty people dey ask question now. Try again small time.'
      : "I'm getting a lot of questions right now. Try again in a minute.";
    return { kind, body, offerHandoff: false };
  }
  const copy = COPY[kind];
  const body = (pidgin ? copy.pcm : copy.en)(supportEmail());
  return { kind, body, offerHandoff: handoffAllowed && OFFERS_HANDOFF[kind] };
}
