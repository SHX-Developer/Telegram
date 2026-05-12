import { Server as IoServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { env } from "../lib/env";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { publicMessage, type PublicMessage } from "../lib/serializers";
import { addUserSocket, removeUserSocket, isOnline } from "./presence";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  SendAck,
} from "./types";

type AppIo = IoServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

let io: AppIo | null = null;

export function getIo(): AppIo {
  if (!io) throw new Error("Socket.IO not initialized — call initIo() first");
  return io;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}
function chatRoom(chatId: string): string {
  return `chat:${chatId}`;
}

async function chatPeerIds(userId: string): Promise<string[]> {
  const rows = await prisma.chatMember.findMany({
    where: {
      chat: { members: { some: { userId } } },
      userId: { not: userId },
    },
    select: { userId: true },
  });
  return Array.from(new Set(rows.map((r) => r.userId)));
}

async function assertMember(userId: string, chatId: string): Promise<boolean> {
  const m = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  return !!m;
}

// ────────────────────────────────────────────────────────────────────────
//  Public helpers (вызываются из REST-роутов)
// ────────────────────────────────────────────────────────────────────────

export async function broadcastNewMessage(message: PublicMessage): Promise<void> {
  if (!io) return;
  // Шлём всем участникам в их персональные user:<id> комнаты, чтобы
  // событие приходило и тем, кто сейчас НЕ открыл чат (для unread/sidebar).
  const members = await prisma.chatMember.findMany({
    where: { chatId: message.chatId },
    select: { userId: true },
  });
  if (members.length === 0) return;
  const rooms = members.map((m) => userRoom(m.userId));
  io.to(rooms).emit("new_message", { message });
}

export interface CreateMessageOptions {
  replyToId?: string | null;
  kind?: "text" | "voice";
  attachmentUrl?: string | null;
  attachmentDurationSec?: number | null;
}

export async function createMessage(
  senderId: string,
  chatId: string,
  text: string,
  options: CreateMessageOptions = {}
): Promise<PublicMessage> {
  // Валидируем replyToId: должен принадлежать тому же чату и не быть удалён.
  let replyToId: string | null = null;
  if (options.replyToId) {
    const target = await prisma.message.findUnique({
      where: { id: options.replyToId },
    });
    if (target && target.chatId === chatId && !target.deletedAt) {
      replyToId = target.id;
    }
  }

  const message = await prisma.message.create({
    data: {
      chatId,
      senderId,
      text,
      replyToId,
      kind: options.kind ?? "text",
      attachmentUrl: options.attachmentUrl ?? null,
      attachmentDurationSec: options.attachmentDurationSec ?? null,
    },
    include: { replyTo: true },
  });
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });

  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId: senderId } },
    data: { lastReadAt: message.createdAt },
  });

  const wire = publicMessage(message);
  await broadcastNewMessage(wire);
  return wire;
}

export function isUserOnline(userId: string): boolean {
  return isOnline(userId);
}

export async function broadcastMessageUpdated(message: PublicMessage): Promise<void> {
  if (!io) return;
  const members = await prisma.chatMember.findMany({
    where: { chatId: message.chatId },
    select: { userId: true },
  });
  if (members.length === 0) return;
  const rooms = members.map((m) => userRoom(m.userId));
  io.to(rooms).emit("message_updated", { message });
}

export async function broadcastMessageDeleted(payload: {
  chatId: string;
  messageId: string;
  forEveryone: boolean;
  /** Если deleted-for-self — отправляем только этому юзеру. */
  forSelfUserId?: string;
}): Promise<void> {
  if (!io) return;
  if (!payload.forEveryone && payload.forSelfUserId) {
    io.to(userRoom(payload.forSelfUserId)).emit("message_deleted", {
      chatId: payload.chatId,
      messageId: payload.messageId,
      forEveryone: false,
    });
    return;
  }
  const members = await prisma.chatMember.findMany({
    where: { chatId: payload.chatId },
    select: { userId: true },
  });
  if (members.length === 0) return;
  const rooms = members.map((m) => userRoom(m.userId));
  io.to(rooms).emit("message_deleted", {
    chatId: payload.chatId,
    messageId: payload.messageId,
    forEveryone: true,
  });
}

export async function broadcastChatCleared(payload: { chatId: string }): Promise<void> {
  if (!io) return;
  const members = await prisma.chatMember.findMany({
    where: { chatId: payload.chatId },
    select: { userId: true },
  });
  if (members.length === 0) return;
  const rooms = members.map((m) => userRoom(m.userId));
  io.to(rooms).emit("chat_cleared", { chatId: payload.chatId });
}

export async function broadcastChatDeleted(payload: {
  chatId: string;
  memberIds: string[];
}): Promise<void> {
  if (!io) return;
  if (payload.memberIds.length === 0) return;
  const rooms = payload.memberIds.map(userRoom);
  io.to(rooms).emit("chat_deleted", { chatId: payload.chatId });
}

// ────────────────────────────────────────────────────────────────────────
//  Init
// ────────────────────────────────────────────────────────────────────────

export function initIo(httpServer: HttpServer): AppIo {
  io = new IoServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      cors: {
        origin(origin, callback) {
          if (!origin) return callback(null, true);
          const isConfigured = env.CORS_ORIGINS.includes(origin);
          const isLocalDev =
            env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
          callback(null, isConfigured || isLocalDev);
        },
        credentials: true,
      },
    }
  );

  // JWT auth handshake. Поддерживаем оба варианта: auth.token и Authorization header.
  io.use((socket, next) => {
    try {
      const fromAuth = (socket.handshake.auth?.token as string | undefined) ?? "";
      const header = socket.handshake.headers.authorization ?? "";
      const token =
        fromAuth ||
        (header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : header);
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.join(userRoom(userId));
    const wasOffline = addUserSocket(userId, socket.id);

    // Если только что стал онлайн — оповестить всех контактов
    if (wasOffline) {
      const peers = await chatPeerIds(userId);
      for (const peerId of peers) {
        io!.to(userRoom(peerId)).emit("user_online", { userId });
      }
    }

    // ─── join / leave chat rooms ──────────────────────────────────────
    socket.on("join_chat", async ({ chatId }) => {
      if (!chatId) return;
      if (await assertMember(userId, chatId)) {
        socket.join(chatRoom(chatId));
      }
    });

    socket.on("leave_chat", ({ chatId }) => {
      if (chatId) socket.leave(chatRoom(chatId));
    });

    // ─── send message via socket ──────────────────────────────────────
    socket.on("send_message", async ({ chatId, text }, ack) => {
      try {
        if (typeof text !== "string" || !text.trim()) {
          return ack({ ok: false, error: "Empty message" });
        }
        if (text.length > 4000) {
          return ack({ ok: false, error: "Message too long" });
        }
        if (!(await assertMember(userId, chatId))) {
          return ack({ ok: false, error: "Not a member of this chat" });
        }
        const wire = await createMessage(userId, chatId, text.trim());
        ack({ ok: true, message: wire });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("send_message failed", err);
        ack({ ok: false, error: "Internal error" });
      }
    });

    // ─── typing ───────────────────────────────────────────────────────
    socket.on("typing_start", async ({ chatId }) => {
      if (!chatId) return;
      if (!(await assertMember(userId, chatId))) return;
      socket.to(chatRoom(chatId)).emit("user_typing", { chatId, userId });
    });
    socket.on("typing_stop", async ({ chatId }) => {
      if (!chatId) return;
      if (!(await assertMember(userId, chatId))) return;
      socket.to(chatRoom(chatId)).emit("user_stopped_typing", { chatId, userId });
    });

    // ─── mark as read ─────────────────────────────────────────────────
    socket.on("mark_read", async ({ chatId }) => {
      if (!chatId) return;
      if (!(await assertMember(userId, chatId))) return;
      const now = new Date();
      await prisma.chatMember.update({
        where: { chatId_userId: { chatId, userId } },
        data: { lastReadAt: now },
      });
      io!.to(chatRoom(chatId)).emit("messages_read", {
        chatId,
        userId,
        lastReadAt: now.toISOString(),
      });
    });

    // ─── disconnect ───────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      const wentOffline = removeUserSocket(userId, socket.id);
      if (!wentOffline) return;

      // Обновить lastSeenAt и оповестить контакты
      const lastSeenAt = new Date();
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { lastSeenAt },
        });
      } catch {
        // юзер мог быть удалён — игнорируем
      }
      const peers = await chatPeerIds(userId);
      for (const peerId of peers) {
        io!.to(userRoom(peerId)).emit("user_offline", {
          userId,
          lastSeenAt: lastSeenAt.toISOString(),
        });
      }
    });
  });

  return io;
}
