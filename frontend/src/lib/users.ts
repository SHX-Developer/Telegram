import { api } from "./api";
import type { User } from "./types";

export async function searchUsers(query: string): Promise<User[]> {
  if (!query.trim()) return [];
  const { data } = await api.get<{ users: User[] }>("/users/search", {
    params: { query },
  });
  return data.users;
}

export async function getUser(id: string): Promise<User> {
  const { data } = await api.get<{ user: User }>(`/users/${id}`);
  return data.user;
}

export async function updateMe(input: {
  displayName?: string;
  avatarUrl?: string | null;
}): Promise<User> {
  const { data } = await api.patch<{ user: User }>("/users/me", input);
  return data.user;
}
