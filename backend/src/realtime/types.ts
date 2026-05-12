import type { PublicMessage } from "../lib/serializers";

export interface ServerToClientEvents {
  new_message: (payload: { message: PublicMessage }) => void;
  message_updated: (payload: { message: PublicMessage }) => void;
  message_deleted: (payload: { chatId: string; messageId: string; forEveryone: boolean }) => void;
  chat_cleared: (payload: { chatId: string }) => void;
  chat_deleted: (payload: { chatId: string }) => void;
  messages_read: (payload: { chatId: string; userId: string; lastReadAt: string }) => void;
  user_typing: (payload: { chatId: string; userId: string }) => void;
  user_stopped_typing: (payload: { chatId: string; userId: string }) => void;
  user_online: (payload: { userId: string }) => void;
  user_offline: (payload: { userId: string; lastSeenAt: string | null }) => void;
}

export type SendAck =
  | { ok: true; message: PublicMessage }
  | { ok: false; error: string };

export interface ClientToServerEvents {
  join_chat: (payload: { chatId: string }) => void;
  leave_chat: (payload: { chatId: string }) => void;
  send_message: (payload: { chatId: string; text: string }, ack: (res: SendAck) => void) => void;
  typing_start: (payload: { chatId: string }) => void;
  typing_stop: (payload: { chatId: string }) => void;
  mark_read: (payload: { chatId: string }) => void;
}

export interface SocketData {
  userId: string;
}
