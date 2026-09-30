interface MessageUser {
  userId: string;
  title: string;
  message: string;
}

interface NotifyUser {
  userId: string;
  title: string;
  message: string;
  cta: string;
}

export type { MessageUser, NotifyUser };
