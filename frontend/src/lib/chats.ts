import { api } from "./api";
import type { Chat, Message } from "./types";

export async function listChats(): Promise<Chat[]> {
  const { data } = await api.get<{ chats: Chat[] }>("/chats");
  return data.chats;
}

export async function createPrivateChat(userId: string): Promise<Chat> {
  const { data } = await api.post<{ chat: Chat }>("/chats/private", { userId });
  return data.chat;
}

export async function listMessages(
  chatId: string,
  opts: { before?: string; limit?: number } = {}
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const { data } = await api.get<{ messages: Message[]; hasMore: boolean }>(
    `/chats/${chatId}/messages`,
    { params: opts }
  );
  return data;
}

export async function sendMessage(
  chatId: string,
  text: string,
  opts: { replyToId?: string | null } = {}
): Promise<Message> {
  const { data } = await api.post<{ message: Message }>(`/chats/${chatId}/messages`, {
    text,
    replyToId: opts.replyToId ?? null,
  });
  return data.message;
}

export async function sendVoiceMessage(
  chatId: string,
  payload: {
    attachmentDataUrl: string;
    durationSec: number;
    replyToId?: string | null;
  }
): Promise<Message> {
  const { data } = await api.post<{ message: Message }>(`/chats/${chatId}/messages`, {
    kind: "voice",
    attachmentDataUrl: payload.attachmentDataUrl,
    durationSec: payload.durationSec,
    replyToId: payload.replyToId ?? null,
  });
  return data.message;
}

export async function sendFileMessage(
  chatId: string,
  payload: {
    attachmentDataUrl: string;
    attachmentName: string;
    attachmentMime: string;
    attachmentSize: number;
    replyToId?: string | null;
  }
): Promise<Message> {
  const { data } = await api.post<{ message: Message }>(`/chats/${chatId}/messages`, {
    kind: "file",
    attachmentDataUrl: payload.attachmentDataUrl,
    attachmentName: payload.attachmentName,
    attachmentMime: payload.attachmentMime,
    attachmentSize: payload.attachmentSize,
    replyToId: payload.replyToId ?? null,
  });
  return data.message;
}

export async function clearChat(chatId: string): Promise<void> {
  await api.delete(`/chats/${chatId}/messages`);
}

export async function deleteChat(chatId: string): Promise<void> {
  await api.delete(`/chats/${chatId}`);
}

export async function createGroupChat(payload: {
  title: string;
  avatarUrl?: string | null;
  memberIds: string[];
}): Promise<Chat> {
  const { data } = await api.post<{ chat: Chat }>("/chats/group", payload);
  return data.chat;
}

export async function createChannelChat(payload: {
  title: string;
  avatarUrl?: string | null;
  memberIds: string[];
}): Promise<Chat> {
  const { data } = await api.post<{ chat: Chat }>("/chats/channel", payload);
  return data.chat;
}

export async function updateChat(
  chatId: string,
  payload: { title?: string; avatarUrl?: string | null }
): Promise<Chat> {
  const { data } = await api.patch<{ chat: Chat }>(`/chats/${chatId}`, payload);
  return data.chat;
}

export async function addChatMembers(chatId: string, userIds: string[]): Promise<void> {
  await api.post(`/chats/${chatId}/members`, { userIds });
}

export async function removeChatMember(chatId: string, userId: string): Promise<void> {
  await api.delete(`/chats/${chatId}/members/${userId}`);
}

export async function setReaction(
  chatId: string,
  messageId: string,
  emoji: string | null
): Promise<void> {
  await api.put(`/chats/${chatId}/messages/${messageId}/reaction`, { emoji });
}

export async function markMessageView(chatId: string, messageId: string): Promise<void> {
  await api.post(`/chats/${chatId}/messages/${messageId}/view`);
}

export async function pinChat(chatId: string): Promise<void> {
  await api.post(`/chats/${chatId}/pin`);
}

export async function unpinChat(chatId: string): Promise<void> {
  await api.delete(`/chats/${chatId}/pin`);
}

export async function pinMessage(chatId: string, messageId: string): Promise<void> {
  await api.post(`/chats/${chatId}/messages/${messageId}/pin`);
}

export async function unpinMessage(chatId: string, messageId: string): Promise<void> {
  await api.delete(`/chats/${chatId}/messages/${messageId}/pin`);
}

export async function forwardMessage(
  fromChatId: string,
  messageId: string,
  chatIds: string[]
): Promise<{ results: Array<{ chatId: string; ok: boolean; error?: string }> }> {
  const { data } = await api.post<{
    results: Array<{ chatId: string; ok: boolean; error?: string }>;
  }>(`/chats/${fromChatId}/messages/${messageId}/forward`, { chatIds });
  return data;
}

export async function editMessage(
  chatId: string,
  messageId: string,
  text: string
): Promise<Message> {
  const { data } = await api.patch<{ message: Message }>(
    `/chats/${chatId}/messages/${messageId}`,
    { text }
  );
  return data.message;
}

export async function deleteMessage(
  chatId: string,
  messageId: string,
  forEveryone: boolean
): Promise<void> {
  await api.delete(`/chats/${chatId}/messages/${messageId}`, {
    params: { forEveryone: forEveryone ? "true" : "false" },
  });
}
