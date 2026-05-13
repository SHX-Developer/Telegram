import type { ChatRoleWire, ChatTypeWire } from "./serializers";

/** Может ли пользователь с этой ролью писать в чат. */
export function canPostInChat(chatType: ChatTypeWire, role: ChatRoleWire | null): boolean {
  if (!role) return false;
  if (chatType === "private") return true;
  if (chatType === "group") return true;
  if (chatType === "channel") {
    // В канале писать могут только owner и admin
    return role === "owner" || role === "admin";
  }
  return false;
}

/**
 * Может ли пользователь редактировать metadata чата (title, avatar) и управлять
 * участниками (приглашать/удалять). Для частных чатов — нет.
 */
export function canManageChat(chatType: ChatTypeWire, role: ChatRoleWire | null): boolean {
  if (!role) return false;
  if (chatType === "private") return false;
  return role === "owner" || role === "admin";
}

/** Может ли пользователь удалять сам чат целиком. */
export function canDeleteChat(chatType: ChatTypeWire, role: ChatRoleWire | null): boolean {
  if (!role) return false;
  if (chatType === "private") return true; // оба участника могут «удалить чат»
  return role === "owner";
}

/** Может ли модерировать роли. */
export function canChangeRoles(role: ChatRoleWire | null): boolean {
  return role === "owner";
}
