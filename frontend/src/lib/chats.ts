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

export async function clearChat(chatId: string): Promise<void> {
  await api.delete(`/chats/${chatId}/messages`);
}

export async function deleteChat(chatId: string): Promise<void> {
  await api.delete(`/chats/${chatId}`);
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
