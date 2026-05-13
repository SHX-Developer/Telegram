import { prisma } from "./prisma";

/** Любая блокировка в любую сторону между двумя юзерами. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const row = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return !!row;
}

/** Заблокировал ли blocker блокируемого. */
export async function hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const row = await prisma.blockedUser.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  return !!row;
}
