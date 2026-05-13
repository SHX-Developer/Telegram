"use client";

import { io, Socket } from "socket.io-client";
import { getStoredToken } from "./api";
import type { Message } from "./types";

const URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type SendAck =
  | { ok: true; message: Message }
  | { ok: false; error: string };

interface ServerToClient {
  new_message: (p: { message: Message }) => void;
  message_updated: (p: { message: Message }) => void;
  message_deleted: (p: { chatId: string; messageId: string; forEveryone: boolean }) => void;
  message_reaction_changed: (p: {
    chatId: string;
    messageId: string;
    userId: string;
    emoji: string | null;
  }) => void;
  message_viewed: (p: { chatId: string; messageId: string; viewsCount: number }) => void;
  chat_pinned_message_changed: (p: { chatId: string; messageId: string | null }) => void;
  chat_cleared: (p: { chatId: string }) => void;
  chat_deleted: (p: { chatId: string }) => void;
  chat_updated: (p: { chatId: string }) => void;
  chat_member_added: (p: { chatId: string; userIds: string[] }) => void;
  chat_member_removed: (p: { chatId: string; userId: string }) => void;
  messages_read: (p: { chatId: string; userId: string; lastReadAt: string }) => void;
  user_typing: (p: { chatId: string; userId: string }) => void;
  user_stopped_typing: (p: { chatId: string; userId: string }) => void;
  user_online: (p: { userId: string }) => void;
  user_offline: (p: { userId: string; lastSeenAt: string | null }) => void;
}

interface ClientToServer {
  join_chat: (p: { chatId: string }) => void;
  leave_chat: (p: { chatId: string }) => void;
  send_message: (p: { chatId: string; text: string }, ack: (r: SendAck) => void) => void;
  typing_start: (p: { chatId: string }) => void;
  typing_stop: (p: { chatId: string }) => void;
  mark_read: (p: { chatId: string }) => void;
}

export type AppSocket = Socket<ServerToClient, ClientToServer>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket | null {
  return socket;
}

export function connectSocket(): AppSocket {
  if (socket) return socket;
  const token = getStoredToken();
  socket = io(URL, {
    auth: { token },
    autoConnect: true,
    transports: ["websocket", "polling"],
    reconnection: true,
  }) as AppSocket;
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** Promise-обёртка над send_message с ack-таймаутом. */
export function sendMessageViaSocket(chatId: string, text: string): Promise<Message> {
  const s = socket;
  if (!s || !s.connected) {
    return Promise.reject(new Error("Socket not connected"));
  }
  return new Promise<Message>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket timeout")), 10_000);
    s.emit("send_message", { chatId, text }, (resp) => {
      clearTimeout(timeout);
      if (resp.ok) resolve(resp.message);
      else reject(new Error(resp.error));
    });
  });
}
