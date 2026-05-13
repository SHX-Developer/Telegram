import { prisma } from "./prisma";
import { isInContacts } from "./contacts";

/**
 * Может ли `senderId` написать `recipientId` в private chat согласно настройке
 * recipient.privacyMessages.
 *
 * Возвращает `{ allowed, reason }` где reason — текст для UI.
 */
export async function canSendPrivateMessage(
  senderId: string,
  recipientId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (senderId === recipientId) return { allowed: true };

  const settings = await prisma.userSettings.findUnique({
    where: { userId: recipientId },
  });
  // По умолчанию (нет настроек) — все могут писать
  if (!settings) return { allowed: true };

  switch (settings.privacyMessages) {
    case "everyone":
      return { allowed: true };
    case "nobody":
      return { allowed: false, reason: "This user does not accept messages" };
    case "contacts": {
      const allowed = await isInContacts(recipientId, senderId);
      return allowed
        ? { allowed: true }
        : { allowed: false, reason: "User accepts messages only from contacts" };
    }
    default:
      return { allowed: true };
  }
}
