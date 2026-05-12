// Shared API response shapes. Keep the wire format separated from the DB model
// so we never accidentally leak passwordHash etc.

export interface PublicUserInput {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export function publicUser(user: PublicUserInput): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export type MessageKind = "text" | "voice";

export interface PublicMessageInput {
  id: string;
  chatId: string;
  senderId: string;
  kind?: MessageKind | null;
  text: string;
  attachmentUrl?: string | null;
  attachmentDurationSec?: number | null;
  createdAt: Date;
  isEdited: boolean;
  deletedAt: Date | null;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    senderId: string;
    kind?: MessageKind | null;
    text: string;
    attachmentDurationSec?: number | null;
    deletedAt: Date | null;
  } | null;
}

export interface PublicMessageReply {
  id: string;
  senderId: string;
  kind: MessageKind;
  text: string;
  attachmentDurationSec: number | null;
  deletedAt: string | null;
}

export interface PublicMessage {
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
  replyTo: PublicMessageReply | null;
}

export function publicMessage(message: PublicMessageInput): PublicMessage {
  const kind: MessageKind = message.kind ?? "text";
  const isDeleted = !!message.deletedAt;
  return {
    id: message.id,
    chatId: message.chatId,
    senderId: message.senderId,
    kind,
    text: isDeleted ? "" : message.text,
    attachmentUrl: isDeleted ? null : message.attachmentUrl ?? null,
    attachmentDurationSec: message.attachmentDurationSec ?? null,
    createdAt: message.createdAt.toISOString(),
    isEdited: message.isEdited,
    deletedAt: isDeleted ? message.deletedAt!.toISOString() : null,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          senderId: message.replyTo.senderId,
          kind: message.replyTo.kind ?? "text",
          text: message.replyTo.deletedAt ? "" : message.replyTo.text,
          attachmentDurationSec: message.replyTo.attachmentDurationSec ?? null,
          deletedAt: message.replyTo.deletedAt
            ? message.replyTo.deletedAt.toISOString()
            : null,
        }
      : null,
  };
}
