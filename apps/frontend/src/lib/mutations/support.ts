import { api } from "@/lib/axios";
import { adminSupportBase, supportBase } from "@/lib/queries/support";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const refreshMine = () => queryClient.invalidateQueries({ queryKey: [supportBase, "conversations"] });
const refreshInbox = () => queryClient.invalidateQueries({ queryKey: [adminSupportBase] });

/** A visitor sends a Turnstile token when the session asks for one. Errors are shown in the chat, not as toasts. */
export const startSupportConversation = mutationOptions({
  mutationKey: [supportBase, "start"],
  mutationFn: async (turnstileToken?: string) =>
    (await api.post<ApiRes<SupportConversation>>(`${supportBase}/conversations`, { turnstileToken })).data.data!,
  onSuccess: () => refreshMine(),
  onError: () => undefined,
});

export const handoffSupportConversation = mutationOptions({
  mutationKey: [supportBase, "handoff"],
  mutationFn: async ({ id, ...input }: SupportHandoffInput & { id: string }) =>
    (await api.post<ApiRes<SupportConversation>>(`${supportBase}/conversations/${id}/handoff`, input)).data.data!,
  onSuccess: (conversation) => {
    queryClient.setQueryData<SupportThread>([supportBase, "conversation", conversation.id], (thread) =>
      thread ? { ...thread, conversation } : thread
    );
    void refreshMine();
  },
  onError: () => undefined,
});

/** The requester ends the conversation (a summary goes to them by email when they have an address). */
export const closeOwnSupportConversation = mutationOptions({
  mutationKey: [supportBase, "close"],
  mutationFn: async (id: string) =>
    (await api.post<ApiRes<SupportConversation>>(`${supportBase}/conversations/${id}/close`)).data.data!,
  onSuccess: (conversation) => {
    queryClient.setQueryData<SupportThread>([supportBase, "conversation", conversation.id], (thread) =>
      thread ? { ...thread, conversation } : thread
    );
    void queryClient.invalidateQueries({ queryKey: [supportBase, "conversation", conversation.id] });
    void refreshMine();
  },
  onError: () => toast.error("Couldn't end the chat. Try again."),
});

/** Thumbs up or down, optimistic: a failure is quiet (the thumbs show what the user chose). */
export const rateSupportMessage = mutationOptions({
  mutationKey: [supportBase, "rate"],
  mutationFn: async ({ id, rating }: { id: string; rating: SupportRating }) =>
    (await api.post<ApiRes<{ id: string; rating: SupportRating }>>(`${supportBase}/messages/${id}/rating`, { rating }))
      .data.data!,
  onError: () => undefined,
});

// Staff

export const claimSupportConversation = mutationOptions({
  mutationKey: [adminSupportBase, "claim"],
  mutationFn: async (id: string) =>
    (await api.post<ApiRes<SupportConversation>>(`${adminSupportBase}/conversations/${id}/claim`)).data,
  onSuccess: (data) => refreshInbox().then(() => toast.success(data.message)),
});

export const replySupportConversation = mutationOptions({
  mutationKey: [adminSupportBase, "reply"],
  mutationFn: async ({ id, text }: { id: string; text: string }) =>
    (await api.post<ApiRes<SupportMessage>>(`${adminSupportBase}/conversations/${id}/messages`, { text })).data,
  onSuccess: () => refreshInbox(),
});

export const closeSupportConversation = mutationOptions({
  mutationKey: [adminSupportBase, "close"],
  mutationFn: async (id: string) =>
    (await api.post<ApiRes<SupportConversation>>(`${adminSupportBase}/conversations/${id}/close`)).data,
  onSuccess: (data) => refreshInbox().then(() => toast.success(data.message)),
});
