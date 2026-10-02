interface UserNotificationDto {
  id: string;
  title: string;
  description: string;
  callToActionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface UserNotificationsDto {
  notifications: UserNotificationDto[];
  unreadCount: number;
}
