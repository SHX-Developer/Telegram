// In-memory presence registry. Сделано просто: Map userId → Set socketIds.
// Если userId есть в карте — он онлайн. Когда последний сокет отвалился —
// удаляем запись и считаем юзера офлайн.

const onlineSockets = new Map<string, Set<string>>();

/** Возвращает true, если это был первый сокет юзера (только что стал онлайн). */
export function addUserSocket(userId: string, socketId: string): boolean {
  const set = onlineSockets.get(userId);
  if (set) {
    set.add(socketId);
    return false;
  }
  onlineSockets.set(userId, new Set([socketId]));
  return true;
}

/** Возвращает true, если это был последний сокет юзера (только что стал офлайн). */
export function removeUserSocket(userId: string, socketId: string): boolean {
  const set = onlineSockets.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineSockets.delete(userId);
    return true;
  }
  return false;
}

export function isOnline(userId: string): boolean {
  return onlineSockets.has(userId);
}

export function filterOnline(userIds: string[]): string[] {
  return userIds.filter((id) => onlineSockets.has(id));
}
