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

export type MessageKind = "text" | "voice";

export interface MessageReply {
  id: string;
  senderId: string;
  kind: MessageKind;
  text: string;
  attachmentDurationSec: number | null;
  deletedAt: string | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  kind: MessageKind;
  text: string;
  attachmentUrl: string | null;
  attachmentDurationSec: number | null;
  createdAt: string;
  isEdited: boolean;
  deletedAt: string | null;
  replyTo: MessageReply | null;
}

export interface Chat {
  id: string;
  type: "private";
  createdAt: string;
  updatedAt: string;
  otherUser: User | null;
  otherUserIsOnline: boolean;
  otherUserLastReadAt: string | null;
  myLastReadAt: string | null;
  lastMessage: Message | null;
  unreadCount: number;
}

// ──── Socket.IO event payloads ──────────────────────────────────────
export interface NewMessagePayload {
  message: Message;
}
export interface MessagesReadPayload {
  chatId: string;
  userId: string;
  lastReadAt: string;
}
export interface TypingPayload {
  chatId: string;
  userId: string;
}
export interface UserOnlinePayload {
  userId: string;
}
export interface UserOfflinePayload {
  userId: string;
  lastSeenAt: string | null;
}
