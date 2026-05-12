import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { publicUser, publicMessage } from "../lib/serializers";
import { isUserOnline, broadcastChatCleared, broadcastChatDeleted } from "../realtime/io";

const router = Router();

router.use(requireAuth);

interface ChatRowMember {
  userId: string;
  lastReadAt: Date | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    lastSeenAt: Date | null;
    createdAt: Date;
  };
}

function serializeChatRow(
  chat: {
    id: string;
    type: "private";
    createdAt: Date;
    updatedAt: Date;
    members: ChatRowMember[];
    messages: Parameters<typeof publicMessage>[0][];
  },
  meId: string,
  unreadCount: number
) {
  const me = chat.members.find((m) => m.userId === meId);
  const other = chat.members.find((m) => m.userId !== meId);
  const lastMessage = chat.messages[0] ?? null;
  return {
    id: chat.id,
    type: chat.type,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    otherUser: other ? publicUser(other.user) : null,
    otherUserIsOnline: other ? isUserOnline(other.userId) : false,
    otherUserLastReadAt: other?.lastReadAt ? other.lastReadAt.toISOString() : null,
    myLastReadAt: me?.lastReadAt ? me.lastReadAt.toISOString() : null,
    lastMessage: lastMessage ? publicMessage(lastMessage) : null,
    unreadCount,
  };
}

// ─────────────────────────────────────────────────────────────────────
// GET /chats
// ─────────────────────────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    select: { chatId: true, lastReadAt: true },
  });
  if (memberships.length === 0) {
    return res.json({ chats: [] });
  }
  const chatIds = memberships.map((m) => m.chatId);

  const chats = await prisma.chat.findMany({
    where: { id: { in: chatIds } },
    include: {
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Подсчёт непрочитанных батчем — groupBy не очень удобен из-за
  // условия по дате. Делаем один Promise.all с обычными count.
  const unreadCounts = await Promise.all(
    memberships.map(async ({ chatId, lastReadAt }) => {
      const count = await prisma.message.count({
        where: {
          chatId,
          senderId: { not: userId },
          deletedAt: null,
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
      return [chatId, count] as const;
    })
  );
  const unreadMap = new Map(unreadCounts);

  const result = chats
    .map((c) => serializeChatRow(c, userId, unreadMap.get(c.id) ?? 0))
    .sort((a, b) => {
      const ta = a.lastMessage?.createdAt ?? a.updatedAt;
      const tb = b.lastMessage?.createdAt ?? b.updatedAt;
      return tb.localeCompare(ta);
    });

  return res.json({ chats: result });
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/private  { userId }
// ─────────────────────────────────────────────────────────────────────
const createPrivateSchema = z.object({
  userId: z.string().min(1),
});

router.post("/private", async (req: AuthRequest, res) => {
  const parsed = createPrivateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const me = req.userId!;
  const other = parsed.data.userId;

  if (other === me) {
    return res.status(400).json({ error: "Cannot create chat with yourself" });
  }

  const otherUser = await prisma.user.findUnique({ where: { id: other } });
  if (!otherUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const existing = await prisma.chat.findFirst({
    where: {
      type: "private",
      AND: [
        { members: { some: { userId: me } } },
        { members: { some: { userId: other } } },
      ],
    },
    include: {
      members: {
        select: { userId: true, lastReadAt: true, user: true },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  let chat = existing;
  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        type: "private",
        members: { create: [{ userId: me }, { userId: other }] },
      },
      include: {
        members: {
          select: { userId: true, lastReadAt: true, user: true },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  return res
    .status(existing ? 200 : 201)
    .json({ chat: serializeChatRow(chat, me, 0) });
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /chats/:chatId/messages    очистить историю чата
// ─────────────────────────────────────────────────────────────────────
router.delete("/:chatId/messages", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const chatId = req.params.chatId as string;

  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  await prisma.message.deleteMany({ where: { chatId } });
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });
  await broadcastChatCleared({ chatId });
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /chats/:chatId    удалить чат целиком
// ─────────────────────────────────────────────────────────────────────
router.delete("/:chatId", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const chatId = req.params.chatId as string;

  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  // Соберём участников ДО удаления, чтобы знать кому слать событие.
  const members = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });

  // Cascade удалит messages и chatMember через FK.
  await prisma.chat.delete({ where: { id: chatId } });

  await broadcastChatDeleted({
    chatId,
    memberIds: members.map((m) => m.userId),
  });
  return res.status(204).end();
});

export default router;
