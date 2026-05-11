export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
