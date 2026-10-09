// Where a support conversation is read, by whom; and its admin notification's subject.

/** The admin prompt for a conversation with the team: cleared once someone claims it. */
export const supportSubject = (id: string) => `support:${id}`;
/**
 * A requester's notification about the team's replies: one per conversation, replaced by each new reply while unread
 * and read when they open it. (Not `supportSubject`: clearing the admins' prompt must not take it away.)
 */
export const replySubject = (id: string) => `support-reply:${id}`;
/** The staff inbox's thread. */
export const inboxLink = (id: string) => `/support-inbox/${id}`;
/** Where a signed-in requester reads the reply: any app page opens the support modal on it. */
export const requesterLink = (id: string) => `/dashboard?support=${id}`;
/** Where a visitor reads it: the public page, on the conversation (their cookie still has to match). */
export const visitorLink = (id: string) => `/support?c=${id}`;
