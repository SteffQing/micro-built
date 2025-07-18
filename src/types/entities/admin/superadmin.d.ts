type AdminListDto = {
  id: string;
  avatar: string | null;
  name: string;
  role: UserRole;
  email: string;
  status: UserStatus;
};
