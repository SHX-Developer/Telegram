import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { publicMessage, type ChatTypeWire, type ChatRoleWire } from "../lib/serializers";
import {
  createMessage,
  broadcastMessageUpdated,
  broadcastMessageDeleted,
  broadcastReactionChanged,
  broadcastMessageViewed,
  broadcastChatPinnedMessage,
} from "../realtime/io";
import { canPostInChat, canManageChat } from "../lib/permissions";
import { isBlockedBetween } from "../lib/blocks";
import { canSendPrivateMessage } from "../lib/messagePolicy";

const router = Router({ mergeParams: true });

router.use(requireAuth);

async function getMembership(userId: string, chatId: string) {
  return prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
}

async function getChat(chatId: string) {
  return prisma.chat.findUnique({ where: { id: chatId } });
}

// ─────────────────────────────────────────────────────────────────────
// GET /chats/:chatId/messages?before=<isoDate>&limit=<n>
// ─────────────────────────────────────────────────────────────────────
const listSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

router.get("/", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const userId = req.userId!;

  const member = await getMembership(userId, chatId);
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { before, limit } = parsed.data;

  const rows = await prisma.message.findMany({
    where: {
      chatId,
      NOT: { deletedForUserIds: { has: userId } },
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      replyTo: true,
      forwardedFromUser: { select: { id: true, displayName: true, username: true } },
      reactions: { select: { userId: true, emoji: true } },
      _count: { select: { views: true } },
    },
  });

  const messages = rows
    .slice()
    .reverse()
    .map((m) =>
      publicMessage(
        {
          ...m,
          reactions: m.reactions ?? [],
          viewsCount: m._count?.views ?? 0,
        },
        userId
      )
    );
  return res.json({
    messages,
    hasMore: rows.length === limit,
  });
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/:chatId/messages
// ─────────────────────────────────────────────────────────────────────
const voiceDataUrlSchema = z
  .string()
  .max(5_000_000)
  .refine((v) => /^data:audio\/(webm|ogg|mp4|mpeg|wav);(codecs=[^;]+;)?base64,/i.test(v), {
    message: "Invalid audio data URL",
  });

const textMessageSchema = z.object({
  kind: z.literal("text").optional(),
  text: z.string().trim().min(1, "Message cannot be empty").max(4000),
  replyToId: z.string().min(1).nullable().optional(),
});

const voiceMessageSchema = z.object({
  kind: z.literal("voice"),
  text: z.string().max(4000).optional(),
  attachmentDataUrl: voiceDataUrlSchema,
  durationSec: z.coerce.number().int().min(0).max(600),
  replyToId: z.string().min(1).nullable().optional(),
});

const fileDataUrlSchema = z
  .string()
  .max(8_000_000)
  .refine((v) => /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;(?:[\w-]+=[^;]+;)*base64,/i.test(v), {
    message: "Invalid file data URL",
  });

const fileMessageSchema = z.object({
  kind: z.literal("file"),
  text: z.string().max(4000).optional(),
  attachmentDataUrl: fileDataUrlSchema,
  attachmentName: z.string().min(1).max(255),
  attachmentMime: z.string().min(1).max(127),
  attachmentSize: z.coerce.number().int().min(0).max(8_000_000),
  replyToId: z.string().min(1).nullable().optional(),
});

router.post("/", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const userId = req.userId!;

  const member = await getMembership(userId, chatId);
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  const chat = await getChat(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  if (!canPostInChat(chat.type as ChatTypeWire, member.role as ChatRoleWire)) {
    return res.status(403).json({ error: "You can't post in this chat" });
  }

  // Запрет писать в private chat если есть блокировка с любой стороны
  // ИЛИ если у получателя privacyMessages запрещает (для пустого чата).
  if (chat.type === "private") {
    const otherMember = await prisma.chatMember.findFirst({
      where: { chatId, userId: { not: userId } },
      select: { userId: true },
    });
    if (otherMember) {
      if (await isBlockedBetween(userId, otherMember.userId)) {
        return res.status(403).json({ error: "Cannot message a blocked user" });
      }
      // privacyMessages проверяем только если в чате ещё нет сообщений —
      // т.е. это «холодный» первый контакт. Если уже общались — разрешаем.
      const hasAny = await prisma.message.findFirst({
        where: { chatId },
        select: { id: true },
      });
      if (!hasAny) {
        const policy = await canSendPrivateMessage(userId, otherMember.userId);
        if (!policy.allowed) {
          return res.status(403).json({ error: policy.reason ?? "Not allowed" });
        }
      }
    }
  }

  const kind = (req.body && typeof req.body === "object" ? req.body.kind : undefined) as
    | string
    | undefined;

  if (kind === "voice") {
    const parsed = voiceMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors[0]?.message ?? "Invalid voice message",
        details: parsed.error.errors,
      });
    }
    const message = await createMessage(userId, chatId, parsed.data.text ?? "", {
      kind: "voice",
      attachmentUrl: parsed.data.attachmentDataUrl,
      attachmentDurationSec: parsed.data.durationSec,
      replyToId: parsed.data.replyToId ?? null,
    });
    return res.status(201).json({ message });
  }

  if (kind === "file") {
    const parsed = fileMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors[0]?.message ?? "Invalid file message",
        details: parsed.error.errors,
      });
    }
    const message = await createMessage(userId, chatId, parsed.data.text ?? "", {
      kind: "file",
      attachmentUrl: parsed.data.attachmentDataUrl,
      attachmentName: parsed.data.attachmentName,
      attachmentMime: parsed.data.attachmentMime,
      attachmentSize: parsed.data.attachmentSize,
      replyToId: parsed.data.replyToId ?? null,
    });
    return res.status(201).json({ message });
  }

  const parsed = textMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      details: parsed.error.errors,
    });
  }

  const message = await createMessage(userId, chatId, parsed.data.text, {
    kind: "text",
    replyToId: parsed.data.replyToId ?? null,
  });
  return res.status(201).json({ message });
});

// ─────────────────────────────────────────────────────────────────────
// PATCH /chats/:chatId/messages/:id   { text }
// ─────────────────────────────────────────────────────────────────────
const editSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

router.patch("/:id", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const messageId = req.params.id as string;
  const userId = req.userId!;

  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.chatId !== chatId) {
    return res.status(404).json({ error: "Message not found" });
  }
  if (existing.senderId !== userId) {
    return res.status(403).json({ error: "Cannot edit someone else's message" });
  }
  if (existing.deletedAt) {
    return res.status(400).json({ error: "Cannot edit a deleted message" });
  }

  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  if (parsed.data.text === existing.text) {
    return res.json({
      message: publicMessage(
        { ...existing, replyTo: null, reactions: [], viewsCount: 0 },
        userId
      ),
    });
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { text: parsed.data.text, isEdited: true },
    include: {
      replyTo: true,
      forwardedFromUser: { select: { id: true, displayName: true, username: true } },
      reactions: { select: { userId: true, emoji: true } },
      _count: { select: { views: true } },
    },
  });

  const wire = publicMessage(
    { ...updated, reactions: updated.reactions ?? [], viewsCount: updated._count?.views ?? 0 },
    userId
  );
  await broadcastMessageUpdated(wire);
  return res.json({ message: wire });
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /chats/:chatId/messages/:id?forEveryone=true|false
// ─────────────────────────────────────────────────────────────────────
const deleteQuerySchema = z.object({
  forEveryone: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const messageId = req.params.id as string;
  const userId = req.userId!;

  const member = await getMembership(userId, chatId);
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.chatId !== chatId) {
    return res.status(404).json({ error: "Message not found" });
  }

  const parsed = deleteQuerySchema.safeParse(req.query);
  const forEveryone = parsed.success ? parsed.data.forEveryone : false;

  if (forEveryone) {
    // В группе/канале глобально удалять может либо автор, либо owner/admin.
    const chat = await getChat(chatId);
    const isAuthor = existing.senderId === userId;
    const isManager = chat
      ? canManageChat(chat.type as ChatTypeWire, member.role as ChatRoleWire)
      : false;
    if (!isAuthor && !isManager && chat?.type !== "private") {
      return res.status(403).json({ error: "Not allowed to delete this message" });
    }
    try {
      await prisma.message.delete({ where: { id: messageId } });
    } catch {
      // already deleted — ok
    }
    await broadcastMessageDeleted({ chatId, messageId, forEveryone: true });
    return res.status(204).end();
  }

  if (!existing.deletedForUserIds.includes(userId)) {
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedForUserIds: { push: userId } },
    });
  }
  await broadcastMessageDeleted({
    chatId,
    messageId,
    forEveryone: false,
    forSelfUserId: userId,
  });
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// PUT /chats/:chatId/messages/:id/reaction   { emoji: string | null }
// emoji=null → снять свою реакцию. Иначе — установить (1 на юзера).
// ─────────────────────────────────────────────────────────────────────
const reactionSchema = z.object({
  emoji: z.string().min(1).max(16).nullable(),
});

router.put("/:id/reaction", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const messageId = req.params.id as string;
  const userId = req.userId!;

  const member = await getMembership(userId, chatId);
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.chatId !== chatId) return res.status(404).json({ error: "Message not found" });
  if (msg.deletedAt) return res.status(400).json({ error: "Message is deleted" });

  const parsed = reactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { emoji } = parsed.data;

  if (emoji === null) {
    await prisma.messageReaction
      .delete({ where: { messageId_userId: { messageId, userId } } })
      .catch(() => undefined);
    await broadcastReactionChanged(chatId, messageId, userId, null);
    return res.status(204).end();
  }

  await prisma.messageReaction.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId, emoji },
    update: { emoji },
  });
  await broadcastReactionChanged(chatId, messageId, userId, emoji);
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/:chatId/messages/:id/view
// Используется в каналах. Идемпотентно — уникальный (messageId, userId).
// ─────────────────────────────────────────────────────────────────────
router.post("/:id/view", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const messageId = req.params.id as string;
  const userId = req.userId!;

  const member = await getMembership(userId, chatId);
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  const chat = await getChat(chatId);
  if (!chat || chat.type !== "channel") {
    // считаем только в каналах
    return res.status(204).end();
  }

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.chatId !== chatId) return res.status(404).json({ error: "Message not found" });
  if (msg.senderId === userId) {
    // автор сам себя не считает
    return res.status(204).end();
  }

  // Идемпотентная вставка
  try {
    await prisma.messageView.create({ data: { messageId, userId } });
  } catch {
    return res.status(204).end();
  }

  const viewsCount = await prisma.messageView.count({ where: { messageId } });
  await broadcastMessageViewed(chatId, messageId, viewsCount);
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/:chatId/messages/:id/pin     закрепить сообщение в чате
// DELETE /chats/:chatId/messages/:id/pin   открепить
// ─────────────────────────────────────────────────────────────────────
router.post("/:id/pin", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const messageId = req.params.id as string;
  const userId = req.userId!;

  const member = await getMembership(userId, chatId);
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  const chat = await getChat(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  // В group/channel pin может только owner/admin. В private — оба участника.
  if (
    chat.type !== "private" &&
    !canManageChat(chat.type as ChatTypeWire, member.role as ChatRoleWire)
  ) {
    return res.status(403).json({ error: "Not allowed to pin" });
  }

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.chatId !== chatId) return res.status(404).json({ error: "Message not found" });
  if (msg.deletedAt) return res.status(400).json({ error: "Message is deleted" });

  await prisma.chat.update({
    where: { id: chatId },
    data: { pinnedMessageId: messageId },
  });
  await broadcastChatPinnedMessage(chatId, messageId);
  return res.status(204).end();
});

router.delete("/:id/pin", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const messageId = req.params.id as string;
  const userId = req.userId!;

  const member = await getMembership(userId, chatId);
  if (!member) return res.status(403).json({ error: "Not a member of this chat" });

  const chat = await getChat(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (
    chat.type !== "private" &&
    !canManageChat(chat.type as ChatTypeWire, member.role as ChatRoleWire)
  ) {
    return res.status(403).json({ error: "Not allowed to unpin" });
  }

  // Открепляем только если pinnedMessageId совпадает.
  if (chat.pinnedMessageId === messageId) {
    await prisma.chat.update({ where: { id: chatId }, data: { pinnedMessageId: null } });
    await broadcastChatPinnedMessage(chatId, null);
  }
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/:chatId/messages/:id/forward   { chatIds[] }
// Создаёт копии сообщения в каждом из chatIds. Каждая копия имеет
// forwardedFromUserId оригинального автора.
// ─────────────────────────────────────────────────────────────────────
const forwardSchema = z.object({
  chatIds: z.array(z.string().min(1)).min(1).max(20),
});

router.post("/:id/forward", async (req: AuthRequest, res) => {
  const messageId = req.params.id as string;
  const userId = req.userId!;

  const parsed = forwardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.deletedAt) return res.status(404).json({ error: "Message not found" });

  // Изначальный автор: если уже было forwarded — сохраняем оригинального.
  const originalUserId = msg.forwardedFromUserId ?? msg.senderId;
  const originalMessageId = msg.forwardedFromMessageId ?? msg.id;

  const targetIds = Array.from(new Set(parsed.data.chatIds));
  const forwarded: Array<{ chatId: string; ok: boolean; error?: string }> = [];

  for (const targetChatId of targetIds) {
    const member = await getMembership(userId, targetChatId);
    if (!member) {
      forwarded.push({ chatId: targetChatId, ok: false, error: "Not a member" });
      continue;
    }
    const targetChat = await getChat(targetChatId);
    if (!targetChat) {
      forwarded.push({ chatId: targetChatId, ok: false, error: "Chat not found" });
      continue;
    }
    if (!canPostInChat(targetChat.type as ChatTypeWire, member.role as ChatRoleWire)) {
      forwarded.push({ chatId: targetChatId, ok: false, error: "Cannot post" });
      continue;
    }

    await createMessage(userId, targetChatId, msg.text, {
      kind: msg.kind,
      attachmentUrl: msg.attachmentUrl,
      attachmentDurationSec: msg.attachmentDurationSec,
      attachmentName: msg.attachmentName,
      attachmentMime: msg.attachmentMime,
      attachmentSize: msg.attachmentSize,
      forwardedFromUserId: originalUserId,
      forwardedFromMessageId: originalMessageId,
    });
    forwarded.push({ chatId: targetChatId, ok: true });
  }

  return res.json({ results: forwarded });
});

export default router;
