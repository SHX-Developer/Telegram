import { prisma } from "./prisma";

/** Является ли b в контактах у a (направленно). */
export async function isInContacts(ownerId: string, contactUserId: string): Promise<boolean> {
  if (ownerId === contactUserId) return true;
  const row = await prisma.contact.findUnique({
    where: { ownerId_contactUserId: { ownerId, contactUserId } },
  });
  return !!row;
}
