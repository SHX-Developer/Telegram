// Shared API response shapes. Keep the wire format separated from the DB model
// so we never accidentally leak passwordHash etc.

export interface PublicUserInput {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phoneNumber: string | null;
  bio: string | null;
  birthday: Date | null;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export interface PublicUser {
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

export function publicUser(user: PublicUserInput): PublicUser {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    bio: user.bio,
    birthday: user.birthday ? user.birthday.toISOString() : null,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export type PrivacyLevelWire = "everyone" | "contacts" | "nobody";

export interface PublicUserPrivacyContext {
  /** ID запрашивающего юзера; null для unauth */
  viewerId: string | null;
  /** В контактах ли (viewer ↔ user). Сейчас всегда false до Contact-фичи. */
  areContacts: boolean;
  /** Настройки приватности пользователя, чьи данные показываем. */
  settings: {
    privacyLastSeen: PrivacyLevelWire;
    privacyAvatar: PrivacyLevelWire;
    privacyBio: PrivacyLevelWire;
  } | null;
}

function privacyAllows(
  level: PrivacyLevelWire,
  viewerId: string | null,
  userId: string,
  areContacts: boolean
): boolean {
  if (viewerId === userId) return true; // сам себе всё видит
  switch (level) {
    case "everyone":
      return true;
    case "contacts":
      return areContacts;
    case "nobody":
      return false;
  }
}

/**
 * Сериализация юзера с учётом приватности. Если viewer — это сам юзер,
 * данные не скрываются. Иначе lastSeen/avatar/bio могут быть null согласно
 * privacy-уровню.
 */
export function publicUserForViewer(
  user: PublicUserInput,
  ctx: PublicUserPrivacyContext
): PublicUser {
  const settings = ctx.settings;
  const lastSeenAllowed = settings
    ? privacyAllows(settings.privacyLastSeen, ctx.viewerId, user.id, ctx.areContacts)
    : true;
  const avatarAllowed = settings
    ? privacyAllows(settings.privacyAvatar, ctx.viewerId, user.id, ctx.areContacts)
    : true;
  const bioAllowed = settings
    ? privacyAllows(settings.privacyBio, ctx.viewerId, user.id, ctx.areContacts)
    : true;

  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    // Номер телефона не показываем никому кроме себя.
    phoneNumber: ctx.viewerId === user.id ? user.phoneNumber : null,
    bio: bioAllowed ? user.bio : null,
    birthday: user.birthday ? user.birthday.toISOString() : null,
    displayName: user.displayName,
    avatarUrl: avatarAllowed ? user.avatarUrl : null,
    lastSeenAt: lastSeenAllowed && user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Собирает displayName из firstName + lastName */
export function composeDisplayName(firstName: string, lastName?: string | null): string {
  const trimmed = (lastName ?? "").trim();
  return trimmed ? `${firstName} ${trimmed}` : firstName;
}

export type MessageKind = "text" | "voice" | "file";
export type ChatTypeWire = "private" | "group" | "channel";
export type ChatRoleWire = "owner" | "admin" | "member" | "subscriber";

export interface ReactionSummary {
  emoji: string;
  count: number;
  /** Поставил ли её текущий пользователь */
  byMe: boolean;
  /** Список ID пользователей поставивших именно этот emoji */
  userIds: string[];
}

export interface PublicMessageInput {
  id: string;
  chatId: string;
  senderId: string;
  kind?: MessageKind | null;
  text: string;
  attachmentUrl?: string | null;
  attachmentDurationSec?: number | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
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
    attachmentName?: string | null;
    deletedAt: Date | null;
  } | null;
  forwardedFromUserId?: string | null;
  forwardedFromUser?: {
    id: string;
    displayName: string;
    username: string | null;
  } | null;
  reactions?: Array<{ userId: string; emoji: string }>;
  viewsCount?: number;
}

export interface PublicMessageReply {
  id: string;
  senderId: string;
  kind: MessageKind;
  text: string;
  attachmentDurationSec: number | null;
  attachmentName: string | null;
  deletedAt: string | null;
}

export interface PublicMessageForwardedFrom {
  userId: string;
  displayName: string;
  username: string | null;
}

export interface PublicMessage {
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
  replyTo: PublicMessageReply | null;
  forwardedFrom: PublicMessageForwardedFrom | null;
  reactions: ReactionSummary[];
  viewsCount: number;
}

export function summarizeReactions(
  rows: Array<{ userId: string; emoji: string }>,
  meId: string | null
): ReactionSummary[] {
  const byEmoji = new Map<string, { count: number; byMe: boolean; userIds: string[] }>();
  for (const r of rows) {
    const cur = byEmoji.get(r.emoji) ?? { count: 0, byMe: false, userIds: [] };
    cur.count += 1;
    cur.userIds.push(r.userId);
    if (meId && r.userId === meId) cur.byMe = true;
    byEmoji.set(r.emoji, cur);
  }
  return Array.from(byEmoji.entries())
    .map(([emoji, v]) => ({ emoji, ...v }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

export function publicMessage(
  message: PublicMessageInput,
  meId: string | null = null
): PublicMessage {
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
    attachmentName: isDeleted ? null : message.attachmentName ?? null,
    attachmentMime: isDeleted ? null : message.attachmentMime ?? null,
    attachmentSize: isDeleted ? null : message.attachmentSize ?? null,
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
          attachmentName: message.replyTo.deletedAt
            ? null
            : message.replyTo.attachmentName ?? null,
          deletedAt: message.replyTo.deletedAt
            ? message.replyTo.deletedAt.toISOString()
            : null,
        }
      : null,
    forwardedFrom: message.forwardedFromUser
      ? {
          userId: message.forwardedFromUser.id,
          displayName: message.forwardedFromUser.displayName,
          username: message.forwardedFromUser.username,
        }
      : null,
    reactions: summarizeReactions(message.reactions ?? [], meId),
    viewsCount: message.viewsCount ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
//  Public chat (приватный/группа/канал)
// ─────────────────────────────────────────────────────────────────────

export interface PublicChatMember {
  userId: string;
  role: ChatRoleWire;
  lastReadAt: string | null;
  user: PublicUser;
  isOnline: boolean;
}

export interface PublicChat {
  id: string;
  type: ChatTypeWire;
  title: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  myRole: ChatRoleWire | null;
  isPinned: boolean;

  /** Только для приватных — собеседник, его статус online и lastReadAt. */
  otherUser: PublicUser | null;
  otherUserIsOnline: boolean;
  otherUserLastReadAt: string | null;

  /** Для group/channel — список участников. Для private — два юзера. */
  members: PublicChatMember[];

  myLastReadAt: string | null;
  lastMessage: PublicMessage | null;
  pinnedMessage: PublicMessage | null;
  unreadCount: number;
}
