"use client";

import { create } from "zustand";
import * as chatsApi from "@/lib/chats";
import { sendMessageViaSocket } from "@/lib/socket";
import type { Chat, Message } from "@/lib/types";

interface TypingState {
  // chatId → Set<userId>
  [chatId: string]: Set<string>;
}

interface ChatsState {
  chats: Chat[];
  chatsLoading: boolean;
  chatsLoaded: boolean;

  activeChatId: string | null;
  messagesByChat: Record<string, Message[]>;
  messagesLoading: Record<string, boolean>;
  hasMoreByChat: Record<string, boolean>;

  typingByChat: TypingState;

  sending: boolean;

  // ─── базовые экшены ────────────────────────────────────────────
  fetchChats: () => Promise<void>;
  setActiveChat: (chatId: string | null) => void;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (
    chatId: string,
    text: string,
    opts?: { replyToId?: string | null; editId?: string | null }
  ) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string, forEveryone: boolean) => Promise<void>;
  sendVoiceMessage: (
    chatId: string,
    payload: { attachmentDataUrl: string; durationSec: number; replyToId?: string | null }
  ) => Promise<void>;
  clearChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  upsertChatFromPrivate: (chat: Chat) => void;
  reset: () => void;

  // ─── socket-реакции ────────────────────────────────────────────
  onIncomingMessage: (message: Message, selfId: string) => void;
  onMessageUpdated: (message: Message) => void;
  onMessageDeleted: (chatId: string, messageId: string, forEveryone: boolean) => void;
  onChatCleared: (chatId: string) => void;
  onChatDeleted: (chatId: string) => void;
  onMessagesRead: (chatId: string, userId: string, lastReadAt: string) => void;
  onUserOnline: (userId: string) => void;
  onUserOffline: (userId: string, lastSeenAt: string | null) => void;
  onUserTyping: (chatId: string, userId: string) => void;
  onUserStoppedTyping: (chatId: string, userId: string) => void;
  resetTyping: (chatId: string) => void;
}

function bumpChatToTop(chats: Chat[], chatId: string, message: Message): Chat[] {
  return chats
    .map((c) =>
      c.id === chatId
        ? { ...c, lastMessage: message, updatedAt: message.createdAt }
        : c
    )
    .sort((a, b) => {
      const ta = a.lastMessage?.createdAt ?? a.updatedAt;
      const tb = b.lastMessage?.createdAt ?? b.updatedAt;
      return tb.localeCompare(ta);
    });
}

export const useChatsStore = create<ChatsState>((set, get) => ({
  chats: [],
  chatsLoading: false,
  chatsLoaded: false,

  activeChatId: null,
  messagesByChat: {},
  messagesLoading: {},
  hasMoreByChat: {},

  typingByChat: {},

  sending: false,

  fetchChats: async () => {
    set({ chatsLoading: true });
    try {
      const chats = await chatsApi.listChats();
      set({ chats, chatsLoaded: true });
    } finally {
      set({ chatsLoading: false });
    }
  },

  setActiveChat: (chatId) => {
    set({ activeChatId: chatId });
    if (chatId && !get().messagesByChat[chatId]) {
      void get().fetchMessages(chatId);
    }
  },

  fetchMessages: async (chatId) => {
    set((s) => ({ messagesLoading: { ...s.messagesLoading, [chatId]: true } }));
    try {
      const { messages, hasMore } = await chatsApi.listMessages(chatId, { limit: 50 });
      set((s) => ({
        messagesByChat: { ...s.messagesByChat, [chatId]: messages },
        hasMoreByChat: { ...s.hasMoreByChat, [chatId]: hasMore },
      }));
    } finally {
      set((s) => ({ messagesLoading: { ...s.messagesLoading, [chatId]: false } }));
    }
  },

  sendMessage: async (chatId, text, opts = {}) => {
    set({ sending: true });
    try {
      // ── режим редактирования
      if (opts.editId) {
        const updated = await chatsApi.editMessage(chatId, opts.editId, text);
        set((s) => ({
          messagesByChat: {
            ...s.messagesByChat,
            [chatId]: (s.messagesByChat[chatId] ?? []).map((m) =>
              m.id === updated.id ? updated : m
            ),
          },
          chats: s.chats.map((c) =>
            c.id === chatId && c.lastMessage?.id === updated.id
              ? { ...c, lastMessage: updated }
              : c
          ),
        }));
        return;
      }

      // ── обычная отправка / ответ
      let message: Message;
      if (opts.replyToId) {
        // socket send_message сейчас не поддерживает replyToId — идём через REST
        message = await chatsApi.sendMessage(chatId, text, { replyToId: opts.replyToId });
      } else {
        try {
          message = await sendMessageViaSocket(chatId, text);
        } catch {
          message = await chatsApi.sendMessage(chatId, text);
        }
      }

      set((s) => {
        const existing = s.messagesByChat[chatId] ?? [];
        const already = existing.some((m) => m.id === message.id);
        return {
          messagesByChat: {
            ...s.messagesByChat,
            [chatId]: already ? existing : [...existing, message],
          },
          chats: bumpChatToTop(s.chats, chatId, message),
        };
      });
    } finally {
      set({ sending: false });
    }
  },

  deleteMessage: async (chatId, messageId, forEveryone) => {
    await chatsApi.deleteMessage(chatId, messageId, forEveryone);
    set((s) => {
      const messages = s.messagesByChat[chatId] ?? [];
      // И «у себя» и «у обоих» — физически убираем из списка
      const next = messages.filter((m) => m.id !== messageId);
      const lastMsg = next.length > 0 ? next[next.length - 1] : null;
      return {
        messagesByChat: { ...s.messagesByChat, [chatId]: next },
        chats: s.chats.map((c) =>
          c.id === chatId && c.lastMessage?.id === messageId
            ? { ...c, lastMessage: lastMsg }
            : c
        ),
      };
    });
  },

  sendVoiceMessage: async (chatId, payload) => {
    set({ sending: true });
    try {
      const message = await chatsApi.sendVoiceMessage(chatId, payload);
      set((s) => {
        const existing = s.messagesByChat[chatId] ?? [];
        const already = existing.some((m) => m.id === message.id);
        return {
          messagesByChat: {
            ...s.messagesByChat,
            [chatId]: already ? existing : [...existing, message],
          },
          chats: bumpChatToTop(s.chats, chatId, message),
        };
      });
    } finally {
      set({ sending: false });
    }
  },

  clearChat: async (chatId) => {
    await chatsApi.clearChat(chatId);
    set((s) => ({
      messagesByChat: { ...s.messagesByChat, [chatId]: [] },
      chats: s.chats.map((c) =>
        c.id === chatId ? { ...c, lastMessage: null, unreadCount: 0 } : c
      ),
    }));
  },

  deleteChat: async (chatId) => {
    await chatsApi.deleteChat(chatId);
    set((s) => {
      const { [chatId]: _omit1, ...restMessages } = s.messagesByChat;
      const { [chatId]: _omit2, ...restLoading } = s.messagesLoading;
      const { [chatId]: _omit3, ...restHasMore } = s.hasMoreByChat;
      const { [chatId]: _omit4, ...restTyping } = s.typingByChat;
      return {
        chats: s.chats.filter((c) => c.id !== chatId),
        messagesByChat: restMessages,
        messagesLoading: restLoading,
        hasMoreByChat: restHasMore,
        typingByChat: restTyping,
        activeChatId: s.activeChatId === chatId ? null : s.activeChatId,
      };
    });
  },

  upsertChatFromPrivate: (chat) => {
    set((s) => {
      const exists = s.chats.some((c) => c.id === chat.id);
      const next = exists
        ? s.chats.map((c) => (c.id === chat.id ? chat : c))
        : [chat, ...s.chats];
      return { chats: next };
    });
  },

  reset: () =>
    set({
      chats: [],
      chatsLoading: false,
      chatsLoaded: false,
      activeChatId: null,
      messagesByChat: {},
      messagesLoading: {},
      hasMoreByChat: {},
      typingByChat: {},
      sending: false,
    }),

  // ─── socket handlers ──────────────────────────────────────────────
  onIncomingMessage: (message, selfId) => {
    const knownChat = get().chats.some((c) => c.id === message.chatId);

    set((s) => {
      const existing = s.messagesByChat[message.chatId] ?? [];
      const already = existing.some((m) => m.id === message.id);
      const isActive = s.activeChatId === message.chatId;
      const isMine = message.senderId === selfId;

      const chats = s.chats
        .map((c) => {
          if (c.id !== message.chatId) return c;
          // Активный чат и чужое сообщение → mark_read обнулит unread.
          // Свои сообщения не увеличивают unread.
          const unread = isMine || isActive ? c.unreadCount : c.unreadCount + 1;
          return {
            ...c,
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount: unread,
          };
        })
        .sort((a, b) => {
          const ta = a.lastMessage?.createdAt ?? a.updatedAt;
          const tb = b.lastMessage?.createdAt ?? b.updatedAt;
          return tb.localeCompare(ta);
        });

      return {
        chats,
        messagesByChat: {
          ...s.messagesByChat,
          [message.chatId]: already ? existing : [...existing, message],
        },
      };
    });

    // Сообщение пришло в чат, которого у нас ещё нет в списке (например,
    // юзер только что создал приватный чат и сразу написал) — подтянем
    // список чатов, чтобы он появился в сайдбаре.
    if (!knownChat) {
      void get().fetchChats();
    }
  },

  onMessageUpdated: (message) => {
    set((s) => ({
      messagesByChat: {
        ...s.messagesByChat,
        [message.chatId]: (s.messagesByChat[message.chatId] ?? []).map((m) =>
          m.id === message.id ? message : m
        ),
      },
      chats: s.chats.map((c) =>
        c.id === message.chatId && c.lastMessage?.id === message.id
          ? { ...c, lastMessage: message }
          : c
      ),
    }));
  },

  onMessageDeleted: (chatId, messageId) => {
    set((s) => {
      const messages = s.messagesByChat[chatId] ?? [];
      const next = messages.filter((m) => m.id !== messageId);
      const lastMsg = next.length > 0 ? next[next.length - 1] : null;
      return {
        messagesByChat: { ...s.messagesByChat, [chatId]: next },
        chats: s.chats.map((c) =>
          c.id === chatId && c.lastMessage?.id === messageId
            ? { ...c, lastMessage: lastMsg }
            : c
        ),
      };
    });
  },

  onChatCleared: (chatId) => {
    set((s) => ({
      messagesByChat: { ...s.messagesByChat, [chatId]: [] },
      chats: s.chats.map((c) =>
        c.id === chatId ? { ...c, lastMessage: null, unreadCount: 0 } : c
      ),
    }));
  },

  onChatDeleted: (chatId) => {
    set((s) => {
      const { [chatId]: _omit1, ...restMessages } = s.messagesByChat;
      const { [chatId]: _omit2, ...restLoading } = s.messagesLoading;
      const { [chatId]: _omit3, ...restHasMore } = s.hasMoreByChat;
      const { [chatId]: _omit4, ...restTyping } = s.typingByChat;
      return {
        chats: s.chats.filter((c) => c.id !== chatId),
        messagesByChat: restMessages,
        messagesLoading: restLoading,
        hasMoreByChat: restHasMore,
        typingByChat: restTyping,
        activeChatId: s.activeChatId === chatId ? null : s.activeChatId,
      };
    });
  },

  onMessagesRead: (chatId, userId, lastReadAt) => {
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== chatId) return c;
        // Если прочитал собеседник — обновим otherUserLastReadAt
        if (c.otherUser?.id === userId) {
          return { ...c, otherUserLastReadAt: lastReadAt };
        }
        // Если прочитал я (например, с другой вкладки) — обнулим unread
        return { ...c, myLastReadAt: lastReadAt, unreadCount: 0 };
      }),
    }));
  },

  onUserOnline: (userId) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.otherUser?.id === userId ? { ...c, otherUserIsOnline: true } : c
      ),
    }));
  },

  onUserOffline: (userId, lastSeenAt) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.otherUser?.id === userId
          ? {
              ...c,
              otherUserIsOnline: false,
              otherUser: c.otherUser ? { ...c.otherUser, lastSeenAt } : c.otherUser,
            }
          : c
      ),
    }));
  },

  onUserTyping: (chatId, userId) => {
    set((s) => {
      const set0 = new Set(s.typingByChat[chatId] ?? []);
      set0.add(userId);
      return { typingByChat: { ...s.typingByChat, [chatId]: set0 } };
    });
  },

  onUserStoppedTyping: (chatId, userId) => {
    set((s) => {
      const set0 = new Set(s.typingByChat[chatId] ?? []);
      set0.delete(userId);
      return { typingByChat: { ...s.typingByChat, [chatId]: set0 } };
    });
  },

  resetTyping: (chatId) => {
    set((s) => {
      const next = { ...s.typingByChat };
      delete next[chatId];
      return { typingByChat: next };
    });
  },
}));
