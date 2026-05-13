import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import {
  publicUser,
  publicMessage,
  type PublicChat,
  type PublicChatMember,
  type ChatRoleWire,
  type ChatTypeWire,
} from "../lib/serializers";
import {
  isUserOnline,
  broadcastChatCleared,
  broadcastChatDeleted,
  broadcastChatUpdated,
  broadcastChatMemberAdded,
  broadcastChatMemberRemoved,
  emitChatToUser,
} from "../realtime/io";
import { canManageChat, canDeleteChat } from "../lib/permissions";
import { isBlockedBetween } from "../lib/blocks";
import { canSendPrivateMessage } from "../lib/messagePolicy";

const router = Router();

router.use(requireAuth);

interface DbChat {
  id: string;
  type: ChatTypeWire;
  title: string | null;
  avatarUrl: string | null;
  pinnedMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    userId: string;
    role: ChatRoleWire;
    isPinned: boolean;
    lastReadAt: Date | null;
    user: Parameters<typeof publicUser>[0];
  }>;
  messages: Array<Parameters<typeof publicMessage>[0]>;
  pinnedMessage?: Parameters<typeof publicMessage>[0] | null;
}

function serializeChat(chat: DbChat, meId: string, unreadCount: number): PublicChat {
  const me = chat.members.find((m) => m.userId === meId);
  const myRole = me?.role ?? null;
  const lastMessage = chat.messages[0] ?? null;

  const memberDtos: PublicChatMember[] = chat.members.map((m) => ({
    userId: m.userId,
    role: m.role,
    lastReadAt: m.lastReadAt ? m.lastReadAt.toISOString() : null,
    user: publicUser(m.user),
    isOnline: isUserOnline(m.userId),
  }));

  const otherMember = chat.type === "private"
    ? chat.members.find((m) => m.userId !== meId) ?? null
    : null;

  return {
    id: chat.id,
    type: chat.type,
    title: chat.title,
    avatarUrl: chat.avatarUrl,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    myRole,
    isPinned: me?.isPinned ?? false,
    otherUser: otherMember ? publicUser(otherMember.user) : null,
    otherUserIsOnline: otherMember ? isUserOnline(otherMember.userId) : false,
    otherUserLastReadAt: otherMember?.lastReadAt
      ? otherMember.lastReadAt.toISOString()
      : null,
    members: memberDtos,
    myLastReadAt: me?.lastReadAt ? me.lastReadAt.toISOString() : null,
    lastMessage: lastMessage ? publicMessage(lastMessage, meId) : null,
    pinnedMessage: chat.pinnedMessage ? publicMessage(chat.pinnedMessage, meId) : null,
    unreadCount,
  };
}

const includeFull = {
  members: {
    select: {
      userId: true,
      role: true,
      isPinned: true,
      lastReadAt: true,
      user: true,
    },
  },
  messages: {
    orderBy: { createdAt: "desc" } as const,
    take: 1,
    include: {
      replyTo: true,
      forwardedFromUser: { select: { id: true, displayName: true, username: true } },
      reactions: { select: { userId: true, emoji: true } },
      _count: { select: { views: true } },
    },
  },
  pinnedMessage: {
    include: {
      replyTo: true,
      forwardedFromUser: { select: { id: true, displayName: true, username: true } },
      reactions: { select: { userId: true, emoji: true } },
      _count: { select: { views: true } },
    },
  },
} as const;

type DbMessageRow = Parameters<typeof publicMessage>[0] & {
  reactions?: Array<{ userId: string; emoji: string }>;
  _count?: { views: number };
};

function normalizeMessageForSerializer(m: DbMessageRow): Parameters<typeof publicMessage>[0] {
  return {
    ...m,
    reactions: m.reactions ?? [],
    viewsCount: m._count?.views ?? 0,
  };
}

function normalizeChat(c: unknown): DbChat {
  const raw = c as DbChat & { pinnedMessage?: DbMessageRow | null };
  return {
    ...raw,
    messages: (raw.messages as DbMessageRow[]).map(normalizeMessageForSerializer),
    pinnedMessage: raw.pinnedMessage
      ? normalizeMessageForSerializer(raw.pinnedMessage)
      : null,
  };
}

async function countUnread(chatId: string, meId: string, lastReadAt: Date | null): Promise<number> {
  return prisma.message.count({
    where: {
      chatId,
      senderId: { not: meId },
      deletedAt: null,
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
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
  if (memberships.length === 0) return res.json({ chats: [] });
  const chatIds = memberships.map((m) => m.chatId);

  const chats = await prisma.chat.findMany({
    where: { id: { in: chatIds } },
    include: includeFull,
  });

  const unreadList = await Promise.all(
    memberships.map(async ({ chatId, lastReadAt }) => {
      const count = await countUnread(chatId, userId, lastReadAt);
      return [chatId, count] as const;
    })
  );
  const unreadMap = new Map(unreadList);

  const out = chats
    .map((c) => serializeChat(normalizeChat(c), userId, unreadMap.get(c.id) ?? 0))
    .sort((a, b) => {
      // Закреплённые всегда сверху
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ta = a.lastMessage?.createdAt ?? a.updatedAt;
      const tb = b.lastMessage?.createdAt ?? b.updatedAt;
      return tb.localeCompare(ta);
    });

  return res.json({ chats: out });
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/private  { userId }
// ─────────────────────────────────────────────────────────────────────
const createPrivateSchema = z.object({
  userId: z.string().min(1),
});

router.post("/private", async (req: AuthRequest, res) => {
  const parsed = createPrivateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const me = req.userId!;
  const other = parsed.data.userId;

  if (other === me) return res.status(400).json({ error: "Cannot create chat with yourself" });

  const otherUser = await prisma.user.findUnique({ where: { id: other } });
  if (!otherUser) return res.status(404).json({ error: "User not found" });

  if (await isBlockedBetween(me, other)) {
    return res.status(403).json({ error: "Cannot start chat with a blocked user" });
  }

  // Если у нас ещё нет существующего чата — проверим privacyMessages получателя.
  // (Если чат уже есть, разрешаем — значит когда-то уже коммуницировали.)
  const existsAny = await prisma.chat.findFirst({
    where: {
      type: "private",
      AND: [
        { members: { some: { userId: me } } },
        { members: { some: { userId: other } } },
      ],
    },
    select: { id: true },
  });
  if (!existsAny) {
    const policy = await canSendPrivateMessage(me, other);
    if (!policy.allowed) {
      return res.status(403).json({ error: policy.reason ?? "Not allowed" });
    }
  }

  const existing = await prisma.chat.findFirst({
    where: {
      type: "private",
      AND: [
        { members: { some: { userId: me } } },
        { members: { some: { userId: other } } },
      ],
    },
    include: includeFull,
  });

  let chat = existing;
  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        type: "private",
        members: {
          create: [
            { userId: me, role: "member" },
            { userId: other, role: "member" },
          ],
        },
      },
      include: includeFull,
    });
  }

  return res
    .status(existing ? 200 : 201)
    .json({ chat: serializeChat(normalizeChat(chat), me, 0) });
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/group   { title, avatarUrl?, memberIds[] }
// POST /chats/channel { title, avatarUrl?, memberIds[] }
// ─────────────────────────────────────────────────────────────────────
const createGroupOrChannelSchema = z.object({
  title: z.string().trim().min(1).max(64),
  avatarUrl: z.string().max(250_000).nullable().optional(),
  memberIds: z.array(z.string().min(1)).max(200).optional(),
});

async function createGroupLikeChat(
  ownerId: string,
  type: "group" | "channel",
  body: unknown,
  res: import("express").Response
) {
  const parsed = createGroupOrChannelSchema.safeParse(body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }
  const { title, avatarUrl, memberIds } = parsed.data;
  const otherIds = Array.from(new Set((memberIds ?? []).filter((id) => id && id !== ownerId)));

  if (otherIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: { id: true },
    });
    const known = new Set(users.map((u) => u.id));
    for (const id of otherIds) {
      if (!known.has(id)) return res.status(404).json({ error: `User ${id} not found` });
    }
  }

  const memberRole: "member" | "subscriber" = type === "channel" ? "subscriber" : "member";
  const chat = await prisma.chat.create({
    data: {
      type,
      title,
      avatarUrl: avatarUrl ?? null,
      members: {
        create: [
          { userId: ownerId, role: "owner" },
          ...otherIds.map((id) => ({ userId: id, role: memberRole })),
        ],
      },
    },
    include: includeFull,
  });

  const dto = serializeChat(normalizeChat(chat), ownerId, 0);

  // Сообщить всем участникам что у них появился новый чат — каждый получит
  // свою «персональную» сериализацию через emitChatToUser. Для простоты шлём
  // одинаковый dto с уточнением myRole per user в реальном клиенте: фронт
  // делает refetchChats при получении chat_updated.
  for (const m of chat.members) {
    await emitChatToUser(m.userId, "chat_updated", { chatId: chat.id });
  }

  return res.status(201).json({ chat: dto });
}

router.post("/group", async (req: AuthRequest, res) => {
  await createGroupLikeChat(req.userId!, "group", req.body, res);
});
router.post("/channel", async (req: AuthRequest, res) => {
  await createGroupLikeChat(req.userId!, "channel", req.body, res);
});

// ─────────────────────────────────────────────────────────────────────
// PATCH /chats/:chatId   { title?, avatarUrl? }
// ─────────────────────────────────────────────────────────────────────
const updateChatSchema = z.object({
  title: z.string().trim().min(1).max(64).optional(),
  avatarUrl: z.string().max(250_000).nullable().optional(),
});

router.patch("/:chatId", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const chatId = req.params.chatId as string;

  const me = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!me) return res.status(403).json({ error: "Not a member" });

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.type === "private") {
    return res.status(400).json({ error: "Cannot edit a private chat" });
  }
  if (!canManageChat(chat.type as ChatTypeWire, me.role as ChatRoleWire)) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const parsed = updateChatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  await prisma.chat.update({
    where: { id: chatId },
    data: parsed.data,
  });
  await broadcastChatUpdated(chatId);

  const refreshed = await prisma.chat.findUnique({
    where: { id: chatId },
    include: includeFull,
  });
  return res.json({ chat: serializeChat(normalizeChat(refreshed), userId, 0) });
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/:chatId/members  { userIds[] }
// ─────────────────────────────────────────────────────────────────────
const addMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(50),
});

router.post("/:chatId/members", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const chatId = req.params.chatId as string;

  const me = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!me) return res.status(403).json({ error: "Not a member" });

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.type === "private") return res.status(400).json({ error: "Cannot modify private" });
  if (!canManageChat(chat.type as ChatTypeWire, me.role as ChatRoleWire)) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const parsed = addMembersSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const ids = Array.from(new Set(parsed.data.userIds));
  const role: "member" | "subscriber" = chat.type === "channel" ? "subscriber" : "member";

  for (const uid of ids) {
    await prisma.chatMember.upsert({
      where: { chatId_userId: { chatId, userId: uid } },
      update: {},
      create: { chatId, userId: uid, role },
    });
  }
  await broadcastChatMemberAdded(chatId, ids);
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /chats/:chatId/members/:userId
// ─────────────────────────────────────────────────────────────────────
router.delete("/:chatId/members/:userId", async (req: AuthRequest, res) => {
  const myId = req.userId!;
  const chatId = req.params.chatId as string;
  const targetId = req.params.userId as string;

  const me = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId: myId } },
  });
  if (!me) return res.status(403).json({ error: "Not a member" });

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.type === "private") return res.status(400).json({ error: "Cannot modify private" });

  // Можно либо удалить себя (leave), либо если есть права — удалить кого-то.
  const isSelf = targetId === myId;
  if (!isSelf && !canManageChat(chat.type as ChatTypeWire, me.role as ChatRoleWire)) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const target = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId: targetId } },
  });
  if (!target) return res.status(204).end();
  // Owner кикать нельзя (он может только удалить весь чат)
  if (target.role === "owner" && !isSelf) {
    return res.status(403).json({ error: "Cannot remove owner" });
  }

  await prisma.chatMember.delete({
    where: { chatId_userId: { chatId, userId: targetId } },
  });
  await broadcastChatMemberRemoved(chatId, targetId);
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/:chatId/pin    закрепить чат (per-user)
// DELETE /chats/:chatId/pin  открепить
// ─────────────────────────────────────────────────────────────────────
const MAX_PINNED_CHATS = 5;

router.post("/:chatId/pin", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const chatId = req.params.chatId as string;
  const me = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!me) return res.status(403).json({ error: "Not a member" });
  if (me.isPinned) return res.status(204).end();

  const pinnedCount = await prisma.chatMember.count({
    where: { userId, isPinned: true },
  });
  if (pinnedCount >= MAX_PINNED_CHATS) {
    return res.status(409).json({
      error: `Maximum ${MAX_PINNED_CHATS} pinned chats. Unpin another first.`,
    });
  }
  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId } },
    data: { isPinned: true },
  });
  return res.status(204).end();
});

router.delete("/:chatId/pin", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const chatId = req.params.chatId as string;
  const me = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!me) return res.status(403).json({ error: "Not a member" });
  if (!me.isPinned) return res.status(204).end();
  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId } },
    data: { isPinned: false },
  });
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /chats/:chatId/messages    очистить историю
// ─────────────────────────────────────────────────────────────────────
router.delete("/:chatId/messages", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const chatId = req.params.chatId as string;

  const me = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!me) return res.status(403).json({ error: "Not a member" });

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  // В группе/канале историю чистит только owner/admin; в private — оба.
  if (chat.type !== "private" && !canManageChat(chat.type as ChatTypeWire, me.role as ChatRoleWire)) {
    return res.status(403).json({ error: "Not allowed" });
  }

  await prisma.message.deleteMany({ where: { chatId } });
  await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
  await broadcastChatCleared({ chatId });
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /chats/:chatId
// ─────────────────────────────────────────────────────────────────────
router.delete("/:chatId", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const chatId = req.params.chatId as string;

  const me = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!me) return res.status(403).json({ error: "Not a member" });

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (!canDeleteChat(chat.type as ChatTypeWire, me.role as ChatRoleWire)) {
    return res.status(403).json({ error: "Only the owner can delete this chat" });
  }

  const members = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });
  await prisma.chat.delete({ where: { id: chatId } });
  await broadcastChatDeleted({
    chatId,
    memberIds: members.map((m) => m.userId),
  });
  return res.status(204).end();
});

export default router;
