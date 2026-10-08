# CHAT_SUPPORT — AI chat support (frontend)

This playbook builds the frontend half of the support assistant decided on 2026-10-07. The decisions (C1–C14), the
rules and the API contract live in **`apps/backend/docs/CHAT_SUPPORT.md`**: read its §0.3 and §2 before any stage here.
This file covers what the browser does: a public `/support` page that still recognises a signed-in user, a centered
modal from the sidebar's "Help & support" icon, and a staff inbox.

Apply it in stages, like V2.MD. When a stage is done, mark it `Status: done (date)` here. A frontend stage starts only
after the backend stage it needs is done (§0.3).

## 0. Context

### 0.1 Where we start

- **"Help & support" is a `mailto:` link.**
  - `SUPPORT_HREF` in `src/lib/support.ts` is used by `navFooter` in `src/components/app-sidebar.tsx` and by the avatar
    menu in `src/components/nav-user.tsx`.
  - `reportProblem()` (Sentry's feedback form) stays as it is.
- **Signed-out visitors can't reach `/support` yet.** Three lists decide this:
  - `isPublicPage` in `src/proxy.ts` (otherwise the visitor is redirected to `/login`);
  - `publicRoutes` in `src/store/auth.ts` (otherwise `GET /user` runs, and a missing account redirects);
  - `redirectExemptRoutes` in `src/lib/axios.ts` (otherwise a 401 sends the visitor to `/login?expired=1`).
- **What exists to build on:**
  - No chat UI, markdown renderer or AI SDK yet.
  - shadcn `Dialog` (`src/components/ui/dialog.tsx`) and vaul `Drawer` (`src/components/ui/drawer.tsx`).
  - `useIsMobile` (`src/hooks/use-mobile.ts`).
  - Icons in `src/components/icon-data.ts`: `icons.support`, `icons.message`, `icons.sparkles`, `icons.mail`.
  - Status screens and brand art: `StatusScreen` and `CalloutArt` (`src/components/status-screen.tsx`,
    `src/components/callouts/callout-art.tsx`).
  - The SSE reconnect pattern in `src/hooks/use-notification-stream.ts`.
- **The marketing layout:** `src/app/(marketing)/layout.tsx` renders `MainNav` (`src/components/flow-header.tsx`) with
  `SessionCta`. A page under `(marketing)` gets the public header for free.
- **Branch:** `v2-chat-support`, as for the backend. Commits go there, not on `v2`, until the merge.

### 0.2 Ground rules (V2.MD §0.2 applies; these are the ones that bite here)

- Edit `apps/frontend/**` only. The API contract is `apps/backend/docs/CHAT_SUPPORT.md` §2 plus Swagger. Never invent
  a field: if the backend lacks something, stop and note it for the backend.
- Pin exact versions: `pnpm --filter @microbuilt/frontend add <pkg>@<exact>`. `ai` comes from the root `catalog:`, since
  the backend uses it too.
- Icons only through `@/components/icon`. Tokens only, no literal colours. Money through `formatCurrency`.
- Every stage ends with `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm build` green, and a look in the browser in
  light and dark at 390 px and 1440 px.
- Commits start `frontend:` and explain why. No attribution trailers.

### 0.3 Stage dependencies on the backend

| Frontend stage | Needs backend stage |
| --- | --- |
| 1 — Public plumbing | A (`GET /support/session`) |
| 2 — Chat | B and C (streaming, tools) |
| 3 — Entry points and `/support` | B |
| 4 — Staff inbox and analytics | D |
| 5 — QA | E |

### 0.4 Locked decisions that shape the UI (from the backend's §0.3)

- **C1** Audiences.
  - A visitor chats with no account data.
  - A customer gets their own data.
  - Staff lookups mirror their app access.
  - The UI never decides access; it renders what `GET /support/session` says.
- **C6** Handoff.
  - Customers, marketers and visitors see "Talk to the team". A visitor must give an email or phone number.
  - ADMIN and SUPER_ADMIN don't hand off. They answer, in the Support inbox.
- **C7** Limits.
  - Turnstile runs once when a visitor starts a conversation.
  - Messages are at most 1,000 characters (counter shown from 800).
  - A 429 shows its sentence inline.
- **C8** Busy. The canned reply arrives with `offerHandoff: true`; the UI shows the handoff card.
- **C9** History. Signed-in users and visitors list their past conversations.
- **C12** The UI.
  - A **centered modal**: `Dialog`, or a full-height `Drawer` on mobile.
  - It opens from the sidebar footer and the avatar menu.
  - The same chat component fills `/support`.
  - Thumbs up or down on each AI reply; a down offers handoff.
  - Suggested prompts come from the session.
  - Super-admin analytics.
  - No attachments.
- **C14** When `enabled: false`, every entry point falls back to `SUPPORT_HREF` (email), and `/support` shows the
  contact block only.

## 1. Behaviour

### 1.1 Talking to the API

- **JSON calls** use the axios `api` client (`withCredentials`), so the visitor cookie and the session both travel.
- **The message stream** uses the AI SDK:
  - `useChat` from `@ai-sdk/react` with a `DefaultChatTransport`:
    - `api`: `${NEXT_PUBLIC_API_URL}/support/conversations/${id}/messages`
    - `credentials: 'include'`
    - `prepareSendMessagesRequest` sends only `{ id, text }` of the new message, because the server holds the
      history (backend §2.1).
  - Initial messages come from `GET /support/conversations/:id`, mapped to UI messages.
- **What the stream carries:**
  - Text parts render as markdown.
  - Tool parts render as one muted status chip: "Checking your loan…", "Looking at your deductions…". A
    `TOOL_LABELS` map, with a fallback of "Looking that up…". Never show tool inputs or outputs.
  - The `{ messageId }` data part attaches the server id to the reply, so it can be rated.
- **Staff replies and status changes** while handed off arrive over SSE: `GET /support/conversations/:id/events`.
  - Open it only while the conversation is `HANDOFF` or `ASSIGNED` and visible.
  - Reconnect with backoff, as `use-notification-stream.ts` does.
  - On an event, invalidate the conversation query.
- Queries and mutations go in `src/lib/queries/support.ts` and `src/lib/mutations/support.ts` (`queryOptions`
  factories, as `src/lib/queries/callouts.ts` does). Types go in an ambient `src/types/support.d.ts` that mirrors the
  backend's DTOs exactly.

### 1.2 The chat component (`src/components/support/support-chat.tsx`)

One component, used by both the modal and the page. Its props: `conversationId?` and `variant: 'modal' | 'page'`.

**Empty state:**
- A greeting: "Hi {firstName}, how can we help?" for a signed-in caller, or "How can we help?" for a visitor.
- Up to 4 suggestion chips from `session.suggestions`.
- For a visitor, one line under the chips: "Sign in to ask about your account."

**Messages:**
- User bubbles sit on the right, `bg-brand text-brand-foreground`.
- AI replies sit on the left on `bg-muted`, with the `sparkles` icon.
- Staff replies sit on the left with the staff member's first name and the `support` icon.
- System lines are centred and muted.
- The newest message scrolls into view unless the user has scrolled up; a "New messages" pill brings them back down.

**Markdown:**
- `react-markdown` with HTML off (`skipHtml`).
- Lists, bold and links only.
- Internal links (starting with `/`) render as `next/link` and close the modal.
- External links get `target="_blank" rel="noopener noreferrer"`.

**Thumbs:**
- Under each finished AI reply that has a `messageId`.
- They call `POST /support/messages/:id/rating`, optimistically.
- A thumbs down reveals the handoff card.

**Handoff card:**
- Shown when a reply has `offerHandoff`, after a thumbs down, or from the "Talk to the team" link in the header (not
  shown for ADMIN or SUPER_ADMIN).
- Text: "Pass this conversation to the team? They usually reply within one working day."
- A visitor gets email and phone fields; one of them is required.
- An optional note.
- It calls `POST /support/conversations/:id/handoff`. The conversation turns `HANDOFF`, and a banner says
  "With the team. We'll reply here and by email."

**Composer:**
- A `Textarea` that auto-grows up to 6 lines. Enter sends; Shift+Enter adds a line.
- Character counter from 800; the limit is 1,000.
- Disabled while a reply streams, with a Stop button (`stop()`).
- `CLOSED` replaces the composer with "This conversation is closed" and a **Start a new conversation** button.

**Errors:**
- A 429 shows its sentence inline above the composer.
- A network error shows "Couldn't reach support. Try again." with a retry.
- A 503 (`enabled: false`) falls back to the email block.

**Accessibility:**
- The message list is `role="log"` with `aria-live="polite"`, announcing finished replies only, not every token.
- Focus goes to the composer on open.
- Reduced motion turns off the typing shimmer.

### 1.3 Conversation list (`conversation-list.tsx`)

- A header button, "Conversations", switches the panel to the list: `GET /support/conversations`.
- Each row shows the title, a status badge ("With the team", "Closed" and so on), relative time, and an unread dot.
- **New conversation**:
  - For a visitor, it runs Turnstile first (`src/components/support/turnstile.tsx`). This is a small component that
    loads `https://challenges.cloudflare.com/turnstile/v0/api.js` once and renders an invisible widget with
    `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. No new dependency.
  - Then it calls `POST /support/conversations`.

### 1.4 The modal (`support-dialog.tsx` + `SupportProvider`)

- `SupportProvider` (`src/components/support/support-provider.tsx`) holds `open` and the current conversation id, and
  exposes `openSupport(conversationId?)`. It is mounted in `src/app/(protected)/layout.tsx`.
- **Desktop:** a centered `Dialog`:
  - `sm:max-w-[560px] h-[min(720px,90dvh)] p-0 flex flex-col`;
  - a sticky header (title "Help & support", Conversations and close buttons);
  - the chat body, scrollable;
  - a sticky composer.
- **Mobile** (`useIsMobile`): a full-height `Drawer` with the same contents.
- Opening it from the mobile sidebar closes the sidebar sheet first (`setOpenMobile(false)`).
- A notification about a staff reply links to `?support=<conversationId>`. The provider reads that search param on any
  protected page, opens the modal on that conversation, then removes the param.

### 1.5 `/support` page (`src/app/(marketing)/support/page.tsx`)

- **Hero:**
  - a `CalloutArt` mosaic band;
  - "Help & support";
  - one line: "Ask our assistant anything about MicroBuilt Prime, or reach the team."
- **The chat** (`variant="page"`): full width, up to `max-w-3xl`, `min-h-[60dvh]`.
- **Contact block:** support email (`SUPPORT_EMAIL`), office hours, and "Report a problem" (`reportProblem()`).
- **Signed in:** the chat uses their session (the API reads the cookie), and `SessionCta` already offers "Dashboard".
  A `?c=<conversationId>` param opens that conversation; the visitor reply email links here.
- **Metadata:** title "Help & support · MicroBuilt Prime", a description, indexable.

## Stage 1 — Public plumbing (needs backend A)

Status: done (2026-10-08). No placeholder page: Stage 3's page went in with it.

1. Add `/support` to:
   - `isPublicPage` in `src/proxy.ts` (`pathname.startsWith("/support")`);
   - `publicRoutes` in `src/store/auth.ts`;
   - `redirectExemptRoutes` in `src/lib/axios.ts`.
2. `src/lib/support.ts`:
   - keep `SUPPORT_EMAIL`;
   - `SUPPORT_HREF` becomes `/support`;
   - add `SUPPORT_MAILTO` for the C14 fallback.
3. Dependencies:
   - `ai` (catalog), `@ai-sdk/react@<exact>`, `react-markdown@<exact>`.
   - As of 2026-10-07: `@ai-sdk/react 4.0.134`, `react-markdown 10.1.0`.
   - Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to `.env.example`.
4. `src/types/support.d.ts`, `src/lib/queries/support.ts` (`supportSession`, `supportConversations`,
   `supportConversation`), `src/lib/mutations/support.ts`.
5. A placeholder `/support` page that renders the session's audience. This proves a signed-out visitor stays on the
   page and gets a visitor cookie, and that a signed-in customer is recognised.

**Verify:** signed out, `/support` loads with no redirect and no 401 bounce. Signed in as a customer, it shows their
first name. tsc, lint and build all pass.

## Stage 2 — Chat (needs backend B and C)

Status: done (2026-10-08). Checked in the browser against a stand-in API that sends the real AI SDK stream (no database
here): streaming, the tool label, markdown and links, a long unbroken word, thumbs, the busy reply's handoff card, a
visitor's handoff, the live staff reply, and writing to the team. Owed against the real API: a customer's balance, a
visitor asking about their loan, 429 and 503.

As built:
- While the conversation is with the team the chat posts JSON with axios (the API answers JSON there, not a stream) and
  refetches on live events; `useChat` handles only the assistant's turns.
- Inside the app, live events come as `support` events on the notification stream (`lib/support-events.ts`); the
  conversation's own stream opens only where that stream isn't running (a visitor, the public `/support` page). It holds off
  while the tab is hidden and catches up when it's shown again. The inbox list and the nav badge refresh on the same events.
- `canHandoff` from the session (backend addition) hides "Talk to the team" for ADMIN and SUPER_ADMIN.

1. `support-chat.tsx` and its parts (§1.2): `message-bubble.tsx`, `markdown.tsx`, `tool-status.tsx`,
   `handoff-card.tsx`, `composer.tsx`, `suggestions.tsx`, `rating.tsx`.
2. `conversation-list.tsx` and `turnstile.tsx` (§1.3).
3. Wire `useChat` (§1.1), including Stop, retry, and the 429, 503 and closed states.

**Verify, in the browser against the local API:**
- A customer asks "what's my balance?": the tool chip shows, then the figure matches the loan page.
- A visitor asks about their loan: the reply says to sign in.
- A thumbs down shows the handoff card.
- The busy state can be forced by pointing `SUPPORT_CHAIN` at one cooled link on the backend.
- Light and dark, at 390 px and 1440 px.

## Stage 3 — Entry points and `/support` (needs backend B)

Status: done (2026-10-08) in code; the modal and drawer need a signed-in check against the real API (owed).

1. `SupportProvider` and `support-dialog.tsx` (§1.4), mounted in the protected layout.
2. `navFooter` in `app-sidebar.tsx`: give entries an optional `onClick`. "Help & support" calls `openSupport()`
   (closing the mobile sheet first) and renders a `button` with the same tooltip and the same `size-10` icon box.
   The others stay `Link`s.
3. `nav-user.tsx`: "Help & support" calls `openSupport()`. "Report a problem" is unchanged.
4. The `/support` page in full (§1.5).
5. C14: when `session.enabled` is false, the footer icon and the menu item go to `SUPPORT_MAILTO`.

**Verify:**
- The modal opens from the footer and from the menu.
- On mobile, the sidebar closes and the drawer opens.
- Following an internal link in a reply closes the modal and navigates.
- `?support=<id>` opens that conversation.
- Light and dark, at 390 px and 1440 px.

## Stage 4 — Staff inbox and analytics (needs backend D)

Status: done (2026-10-08) in code; the two-browser round trip is owed (it needs the migration applied). The nav badge
reads `GET /admin/support/waiting` (backend addition), every minute.

1. `src/app/(protected)/support-inbox/page.tsx` (ADMIN and SUPER_ADMIN; other roles get `AccessDenied`):
   - Tabs: **Waiting** (`HANDOFF`), **Mine** (`assignee=me`), **All**, **Closed**. Each tab has a search box and the
     table skeleton while it loads.
   - Rows: title, requester (name and role, or the visitor's contact), status, how long it has waited, and an unread
     dot.
2. `src/app/(protected)/support-inbox/[id]/page.tsx`:
   - The thread, read-only for AI turns. Each AI message shows a muted "looked at: loan, deductions" line from its
     `toolNames`.
   - A requester card links to the customer's page.
   - **Claim**, **Reply** (a composer of up to 4,000 characters) and **Close**.
   - Live over the conversation's SSE.
3. A nav item "Support" (`icons.support`) in `navAdmin`, so `navSuperAdmin` inherits it. Its badge counts
   conversations in `HANDOFF`. Admin notifications with subject `support:<id>` link to the thread.
4. An **Analytics** tab, for SUPER_ADMIN only (`GET /admin/support/analytics`):
   - stat tiles: conversations, handoff rate, 👍/👎 ratio, busy replies;
   - a per-day chart;
   - a provider-usage table;
   - a quota-hits table.

   Charts follow the existing dashboard's chart components and tokens.

**Verify:**
- The full round trip with two browsers: a customer hands off; the admin sees the badge and the notification, claims
  and replies; the customer sees the reply live in the modal and gets the email.
- A marketer gets `AccessDenied` on `/support-inbox`.
- Light and dark, at 390 px and 1440 px.

## Stage 5 — QA, docs

Status: docs done (2026-10-08); the keyboard, screen-reader, reduced-motion, slow-network and 390 px / light-mode passes are
owed (the automation browser here couldn't resize, and reports every tab hidden).

1. Keyboard-only pass:
   - open the modal, send, rate, hand off, close;
   - the focus trap and Escape work;
   - screen-reader announcements fire once per reply.
2. Reduced motion, long replies, a long unbroken string (wraps, no horizontal scroll), and a slow network (Stop works).
3. Update `docs/APP_FLOW.md`: `/support` is public, the support modal, the staff inbox route, and the role matrix row.
4. Mark the statuses here.

**Verify:** tsc, lint and build all pass; every screen checked in light and dark at 390 px and 1440 px.

## Risks to watch

- **Streaming through a proxy.** The stream and SSE must go direct to `NEXT_PUBLIC_API_URL`, not through the `/api`
  rewrite, which could buffer them. The visitor cookie also has to come back to the same host (backend §1.1).
- **`useChat` holding history.** The client must send only the new message (`prepareSendMessagesRequest`), or the
  server's history and the client's drift apart and every request grows.
- **Leaking through the UI.** Tool inputs and outputs are never rendered, and nothing about providers or models
  appears anywhere in the UI (C5).
- **The modal on top of the mobile sidebar sheet.** Close the sheet first, or the two fight over focus.
- **Free-tier latency.** The first chunk can take seconds when the chain falls through. Show the typing state
  immediately, and the tool chips as they arrive.
