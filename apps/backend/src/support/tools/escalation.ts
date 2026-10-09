import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { PrismaService } from 'src/database/prisma.service';
import { SYSTEM_ACTOR_ID } from 'src/ledger/ledger.constants';
import type { InappService } from 'src/notifications/inapp.service';
import { inboxLink } from '../paths';

// What the assistant does instead of saying it did it (it used to answer "I have escalated your request" with nothing
// behind it): super admins hear of an escalation or feedback in-app, and someone who can pass the conversation to the
// team is shown the button for it. The caller and conversation come from the session, never from the model.

export interface EscalationDeps {
  prisma: Pick<PrismaService, 'admin' | 'user'>;
  notifications: Pick<InappService, 'messageUsers' | 'removeBySubject'>;
}

export interface EscalationContext {
  userId: string;
  conversationId: string;
  /** Customers and marketers: the "Talk to the team" card is theirs to press. */
  canHandoff: boolean;
}

/** One escalation notification per conversation: a later one replaces it. */
export const escalationSubject = (conversationId: string) => `support-escalation:${conversationId}`;

const SUMMARY_CHARS = 300;

export function escalationTools(deps: EscalationDeps, ctx: EscalationContext): ToolSet {
  let sent = false;
  const tools: ToolSet = {
    send_to_super_admins: tool({
      description:
        'Tell the super admins, in the app, about something from this conversation that needs them: an escalation ' +
        'the user asked for (e.g. "I want to talk to a super admin"), a complaint, or feedback to pass on. Write a ' +
        'short factual summary: what happened and what the user wants. Only when the user asks for it or clearly ' +
        'wants it passed on. Say it was sent only after this returns sent: true.',
      inputSchema: z.object({
        kind: z.enum(['escalation', 'feedback']).describe('escalation: they want a super admin; feedback: pass it on'),
        summary: z.string().describe(`What to pass on, at most ${SUMMARY_CHARS} characters`),
      }),
      execute: async ({ kind, summary }) => {
        const text = summary.replace(/\s+/g, ' ').trim().slice(0, SUMMARY_CHARS);
        if (!text) return { sent: false, message: 'Write what to pass on first' };
        if (sent) return { sent: true, message: 'Already sent in this reply' };
        const [sender, superAdmins] = await Promise.all([
          deps.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
          deps.prisma.admin.findMany({
            where: { role: 'SUPER_ADMIN', userId: { notIn: [SYSTEM_ACTOR_ID, ctx.userId] }, user: { status: 'ACTIVE' } },
            select: { userId: true },
          }),
        ]);
        if (superAdmins.length === 0) return { sent: false, message: 'There is no other super admin to tell' };
        const name = sender?.name ?? 'Someone';
        await deps.notifications.removeBySubject(escalationSubject(ctx.conversationId));
        await deps.notifications.messageUsers(
          superAdmins.map((admin) => admin.userId),
          {
            title: kind === 'feedback' ? `Feedback from ${name}` : `${name} asked for a super admin`,
            message: text,
            callToActionUrl: inboxLink(ctx.conversationId),
            subject: escalationSubject(ctx.conversationId),
          },
        );
        sent = true;
        return { sent: true, told: 'the super admins, in the app', message: 'Say it was passed on; no email is sent' };
      },
    }),
  };
  if (ctx.canHandoff) {
    tools.offer_team = tool({
      description:
        'Show the "Talk to the team" button under your reply: for a user who wants a person, wants to escalate, or ' +
        "whom you can't help. You can't pass the conversation on yourself; they press the button and leave a note.",
      inputSchema: z.object({}),
      execute: async () => ({ shown: true, tell: 'Ask them to press "Talk to the team" below your reply.' }),
    });
  }
  return tools;
}
