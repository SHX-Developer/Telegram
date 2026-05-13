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
  firstName?: string;
  lastName?: string | null;
  bio?: string | null;
  birthday?: string | null;
  phoneNumber?: string;
  avatarUrl?: string | null;
}): Promise<User> {
  const { data } = await api.patch<{ user: User }>("/users/me", input);
  return data.user;
}

export async function setMyUsername(username: string | null): Promise<User> {
  const { data } = await api.patch<{ user: User }>("/users/me/username", { username });
  return data.user;
}

import type { UserSettings, PrivacyLevel } from "./types";

export async function getMySettings(): Promise<UserSettings> {
  const { data } = await api.get<{ settings: UserSettings }>("/users/me/settings");
  return data.settings;
}

export async function updateMySettings(
  payload: Partial<UserSettings>
): Promise<UserSettings> {
  const { data } = await api.patch<{ settings: UserSettings }>("/users/me/settings", payload);
  return data.settings;
}

export async function getBlockedUsers(): Promise<User[]> {
  const { data } = await api.get<{ users: User[] }>("/users/me/blocked");
  return data.users;
}

export async function blockUser(userId: string): Promise<void> {
  await api.post(`/users/${userId}/block`);
}

export async function unblockUser(userId: string): Promise<void> {
  await api.delete(`/users/${userId}/block`);
}

export async function getContacts(): Promise<User[]> {
  const { data } = await api.get<{ users: User[] }>("/users/me/contacts");
  return data.users;
}

export async function addContact(userId: string): Promise<void> {
  await api.post(`/users/${userId}/contact`);
}

export async function removeContact(userId: string): Promise<void> {
  await api.delete(`/users/${userId}/contact`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _PrivacyLevelExport = PrivacyLevel;
