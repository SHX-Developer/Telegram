import type { Chat } from "./types";

export function canPostInChat(chat: Chat | null | undefined): boolean {
  if (!chat) return false;
  if (chat.type === "private") return true;
  if (chat.type === "group") return chat.myRole !== null;
  if (chat.type === "channel") return chat.myRole === "owner" || chat.myRole === "admin";
  return false;
}

export function canManageChat(chat: Chat | null | undefined): boolean {
  if (!chat) return false;
  if (chat.type === "private") return false;
  return chat.myRole === "owner" || chat.myRole === "admin";
}

export function canDeleteChat(chat: Chat | null | undefined): boolean {
  if (!chat) return false;
  if (chat.type === "private") return true;
  return chat.myRole === "owner";
}

export function chatDisplayName(chat: Chat | null | undefined): string {
  if (!chat) return "";
  if (chat.type === "private") return chat.otherUser?.displayName ?? "Unknown";
  return chat.title ?? "Untitled";
}
