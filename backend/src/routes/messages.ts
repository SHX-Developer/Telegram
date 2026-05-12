import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { publicMessage } from "../lib/serializers";
import {
  createMessage,
  broadcastMessageUpdated,
  broadcastMessageDeleted,
} from "../realtime/io";

const router = Router({ mergeParams: true });

router.use(requireAuth);

async function assertMember(userId: string, chatId: string): Promise<boolean> {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  return !!member;
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

  if (!(await assertMember(userId, chatId))) {
    return res.status(403).json({ error: "Not a member of this chat" });
  }

  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { before, limit } = parsed.data;

  const rows = await prisma.message.findMany({
    where: {
      chatId,
      // Скрываем удалённые "для себя"
      NOT: { deletedForUserIds: { has: userId } },
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { replyTo: true },
  });

  const messages = rows.slice().reverse().map(publicMessage);
  return res.json({
    messages,
    hasMore: rows.length === limit,
  });
});

// ─────────────────────────────────────────────────────────────────────
// POST /chats/:chatId/messages   { text, replyToId?, kind?, attachmentDataUrl?, durationSec? }
// ─────────────────────────────────────────────────────────────────────
const voiceDataUrlSchema = z
  .string()
  .max(5_000_000)
  .refine((v) => /^data:audio\/(webm|ogg|mp4|mpeg|wav);(codecs=[^;]+;)?base64,/i.test(v), {
    message: "Invalid audio data URL",
  });

const createSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text").optional(),
    text: z.string().trim().min(1, "Message cannot be empty").max(4000),
    replyToId: z.string().min(1).nullable().optional(),
  }),
  z.object({
    kind: z.literal("voice"),
    text: z.string().max(4000).optional(),
    attachmentDataUrl: voiceDataUrlSchema,
    durationSec: z.coerce.number().int().min(0).max(600),
    replyToId: z.string().min(1).nullable().optional(),
  }),
]);

router.post("/", async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;
  const userId = req.userId!;

  if (!(await assertMember(userId, chatId))) {
    return res.status(403).json({ error: "Not a member of this chat" });
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const data = parsed.data;
  if (data.kind === "voice") {
    const message = await createMessage(userId, chatId, data.text ?? "", {
      kind: "voice",
      attachmentUrl: data.attachmentDataUrl,
      attachmentDurationSec: data.durationSec,
      replyToId: data.replyToId ?? null,
    });
    return res.status(201).json({ message });
  }

  const message = await createMessage(userId, chatId, data.text, {
    kind: "text",
    replyToId: data.replyToId ?? null,
  });
  return res.status(201).json({ message });
});

// ─────────────────────────────────────────────────────────────────────
// PATCH /chats/:chatId/messages/:id   { text }
// Только автор. Не редактируем уже удалённые.
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
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  if (parsed.data.text === existing.text) {
    // ничего не поменялось
    return res.json({ message: publicMessage({ ...existing, replyTo: null }) });
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { text: parsed.data.text, isEdited: true },
    include: { replyTo: true },
  });

  const wire = publicMessage(updated);
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

  if (!(await assertMember(userId, chatId))) {
    return res.status(403).json({ error: "Not a member of this chat" });
  }

  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.chatId !== chatId) {
    return res.status(404).json({ error: "Message not found" });
  }

  const parsed = deleteQuerySchema.safeParse(req.query);
  const forEveryone = parsed.success ? parsed.data.forEveryone : false;

  if (forEveryone) {
    // Любой участник чата может удалить сообщение для обоих (тоже самое, что
    // в иных мессенджерах: модерация для двоих).
    try {
      await prisma.message.delete({ where: { id: messageId } });
    } catch {
      // Сообщение могло быть уже удалено параллельно — ок.
    }
    await broadcastMessageDeleted({ chatId, messageId, forEveryone: true });
    return res.status(204).end();
  }

  // Удалить только у себя — добавляем userId в deletedForUserIds
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

export default router;
