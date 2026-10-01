interface MessageUser {
  userId: string;
  title: string;
  message: string;
  /** Where the notification leads when opened (a page in the app, or a signed file link). */
  callToActionUrl?: string;
}

interface NotifyUser {
  userId: string;
  title: string;
  message: string;
  cta: string;
}

export type { MessageUser, NotifyUser };
