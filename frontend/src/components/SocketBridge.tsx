"use client";

import { useEffect } from "react";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth";
import { useChatsStore } from "@/store/chats";

/**
 * Невидимый компонент, который при наличии авторизованного юзера
 * поднимает socket-соединение и роутит входящие события в zustand-стор.
 * Монтируется на верхнем уровне (app)/layout.
 */
export function SocketBridge() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    const socket = connectSocket();
    const store = useChatsStore.getState();

    const onNewMessage = ({ message }: { message: Parameters<typeof store.onIncomingMessage>[0] }) => {
      store.onIncomingMessage(message, user.id);
    };
    const onMessageUpdated = ({ message }: { message: Parameters<typeof store.onMessageUpdated>[0] }) => {
      store.onMessageUpdated(message);
    };
    const onMessageDeleted = ({
      chatId,
      messageId,
      forEveryone,
    }: {
      chatId: string;
      messageId: string;
      forEveryone: boolean;
    }) => store.onMessageDeleted(chatId, messageId, forEveryone);
    const onChatCleared = ({ chatId }: { chatId: string }) => store.onChatCleared(chatId);
    const onChatDeleted = ({ chatId }: { chatId: string }) => store.onChatDeleted(chatId);
    const onMessagesRead = ({
      chatId,
      userId,
      lastReadAt,
    }: {
      chatId: string;
      userId: string;
      lastReadAt: string;
    }) => store.onMessagesRead(chatId, userId, lastReadAt);

    const onUserOnline = ({ userId }: { userId: string }) => store.onUserOnline(userId);
    const onUserOffline = ({
      userId,
      lastSeenAt,
    }: {
      userId: string;
      lastSeenAt: string | null;
    }) => store.onUserOffline(userId, lastSeenAt);

    const onTyping = ({ chatId, userId }: { chatId: string; userId: string }) =>
      store.onUserTyping(chatId, userId);
    const onStoppedTyping = ({ chatId, userId }: { chatId: string; userId: string }) =>
      store.onUserStoppedTyping(chatId, userId);

    socket.on("new_message", onNewMessage);
    socket.on("message_updated", onMessageUpdated);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("chat_cleared", onChatCleared);
    socket.on("chat_deleted", onChatDeleted);
    socket.on("messages_read", onMessagesRead);
    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);
    socket.on("user_typing", onTyping);
    socket.on("user_stopped_typing", onStoppedTyping);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("message_updated", onMessageUpdated);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("chat_cleared", onChatCleared);
      socket.off("chat_deleted", onChatDeleted);
      socket.off("messages_read", onMessagesRead);
      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
      socket.off("user_typing", onTyping);
      socket.off("user_stopped_typing", onStoppedTyping);
      disconnectSocket();
    };
  }, [user]);

  return null;
}
