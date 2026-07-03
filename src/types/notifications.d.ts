interface UserNotificationDto {
  id: string;
  title: string;
  description: string;
  callToActionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface UserNotificationsDto {
  notifications: UserNotificationDto[];
  unreadCount: number;
}
