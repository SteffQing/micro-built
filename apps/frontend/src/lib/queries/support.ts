import { api } from "@/lib/axios";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";

// Chat support. The axios `api` client calls the API directly with credentials, so the session and a visitor's
// support cookie both travel (backend CHAT_SUPPORT.md §1.1).

export const supportBase = "/support";
export const adminSupportBase = "/admin/support";

/** Who the chat is talking to. Signed out, it also sets the visitor cookie. */
export const supportSession = queryOptions({
  queryKey: [supportBase, "session"],
  queryFn: async () => (await api.get<ApiRes<SupportSession>>(`${supportBase}/session`)).data.data!,
  staleTime: 5 * 60 * 1000,
  retry: false,
});

export const supportConversations = (page = 1) =>
  queryOptions({
    queryKey: [supportBase, "conversations", page],
    queryFn: async () => {
      const res = await api.get<ApiRes<SupportConversationRow[]>>(`${supportBase}/conversations`, { params: { page } });
      return { rows: res.data.data ?? [], meta: res.data.meta };
    },
    placeholderData: keepPreviousData,
  });

export const supportConversation = (id: string) =>
  queryOptions({
    queryKey: [supportBase, "conversation", id],
    queryFn: async () => (await api.get<ApiRes<SupportThread>>(`${supportBase}/conversations/${id}`)).data.data!,
    // Read on open (so a reopened conversation has the replies streamed since) and on a live event; while open, the
    // chat holds the live messages.
    placeholderData: undefined,
  });

// Staff

export const staffSupportConversations = (query: StaffSupportQuery) =>
  queryOptions({
    queryKey: [adminSupportBase, "conversations", query],
    queryFn: async () => {
      const res = await api.get<ApiRes<StaffSupportRow[]>>(`${adminSupportBase}/conversations`, { params: query });
      return { rows: res.data.data ?? [], meta: res.data.meta };
    },
  });

export const staffSupportConversation = (id: string) =>
  queryOptions({
    queryKey: [adminSupportBase, "conversation", id],
    queryFn: async () => (await api.get<ApiRes<StaffSupportThread>>(`${adminSupportBase}/conversations/${id}`)).data.data!,
    placeholderData: undefined,
  });

/** Conversations waiting to be claimed: the nav badge. */
export const supportWaiting = queryOptions({
  queryKey: [adminSupportBase, "waiting"],
  queryFn: async () => (await api.get<ApiRes<{ count: number }>>(`${adminSupportBase}/waiting`)).data.data?.count ?? 0,
  refetchInterval: 60 * 1000,
  retry: false,
});

export const supportAnalytics = (from: string, to: string) =>
  queryOptions({
    queryKey: [adminSupportBase, "analytics", from, to],
    queryFn: async () =>
      (await api.get<ApiRes<SupportAnalytics>>(`${adminSupportBase}/analytics`, { params: { from, to } })).data.data!,
  });
