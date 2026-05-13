export interface User {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phoneNumber: string | null;
  bio: string | null;
  birthday: string | null;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type MessageKind = "text" | "voice" | "file";
export type ChatType = "private" | "group" | "channel";
export type ChatRole = "owner" | "admin" | "member" | "subscriber";
export type PrivacyLevel = "everyone" | "contacts" | "nobody";

export interface UserSettings {
  privacyLastSeen: PrivacyLevel;
  privacyAvatar: PrivacyLevel;
  privacyBio: PrivacyLevel;
  privacyMessages: PrivacyLevel;
}

export interface MessageReply {
  id: string;
  senderId: string;
  kind: MessageKind;
  text: string;
  attachmentDurationSec: number | null;
  attachmentName: string | null;
  deletedAt: string | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  byMe: boolean;
  userIds: string[];
}

export interface MessageForwardedFrom {
  userId: string;
  displayName: string;
  username: string | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  kind: MessageKind;
  text: string;
  attachmentUrl: string | null;
  attachmentDurationSec: number | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  createdAt: string;
  isEdited: boolean;
  deletedAt: string | null;
  replyTo: MessageReply | null;
  forwardedFrom: MessageForwardedFrom | null;
  reactions: ReactionSummary[];
  viewsCount: number;
}

export interface ChatMember {
  userId: string;
  role: ChatRole;
  lastReadAt: string | null;
  user: User;
  isOnline: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  title: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  myRole: ChatRole | null;
  isPinned: boolean;
  /** Только для private */
  otherUser: User | null;
  otherUserIsOnline: boolean;
  otherUserLastReadAt: string | null;
  members: ChatMember[];
  myLastReadAt: string | null;
  lastMessage: Message | null;
  pinnedMessage: Message | null;
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
