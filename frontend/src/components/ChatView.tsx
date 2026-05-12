"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { MessageActionsMenu, type MessageAction } from "./MessageActionsMenu";
import { DeleteMessageDialog } from "./DeleteMessageDialog";
import { ChatHeaderMenu } from "./ChatHeaderMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { useChatsStore } from "@/store/chats";
import { useAuthStore } from "@/store/auth";
import { getSocket } from "@/lib/socket";
import type { Message } from "@/lib/types";

interface Props {
  chatId: string;
}

interface SelectedMessage {
  message: Message;
  x: number;
  y: number;
}

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "был(а) недавно";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "только что был(а) в сети";
  if (mins < 60) return `был(а) ${mins} мин назад`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `был(а) ${hours} ч назад`;
  return `был(а) ${d.toLocaleDateString()}`;
}

export function ChatView({ chatId }: Props) {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const {
    chats,
    setActiveChat,
    messagesByChat,
    messagesLoading,
    sendMessage,
    sendVoiceMessage,
    deleteMessage,
    fetchChats,
    chatsLoaded,
    typingByChat,
    resetTyping,
    clearChat,
    deleteChat,
  } = useChatsStore();

  const chat = useMemo(() => chats.find((c) => c.id === chatId), [chats, chatId]);
  const messages = messagesByChat[chatId] ?? [];

  const [selected, setSelected] = useState<SelectedMessage | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);

  useEffect(() => {
    setSelected(null);
    setEditing(null);
    setReplyTo(null);
    setDeleting(null);
    setShowClearConfirm(false);
    setShowDeleteChatConfirm(false);
  }, [chatId]);

  useEffect(() => {
    setActiveChat(chatId);
    const socket = getSocket();
    socket?.emit("join_chat", { chatId });
    socket?.emit("mark_read", { chatId });
    return () => {
      socket?.emit("leave_chat", { chatId });
      resetTyping(chatId);
      setActiveChat(null);
    };
  }, [chatId, setActiveChat, resetTyping]);

  useEffect(() => {
    if (!chatsLoaded) void fetchChats();
  }, [chatsLoaded, fetchChats]);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.senderId !== me?.id) {
      getSocket()?.emit("mark_read", { chatId });
    }
  }, [messages, chatId, me?.id]);

  // Esc priority: модалки → меню → edit/reply → /chats
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.isComposing) return;
      if (deleting || showClearConfirm || showDeleteChatConfirm || selected) return;
      if (editing) {
        e.preventDefault();
        setEditing(null);
        return;
      }
      if (replyTo) {
        e.preventDefault();
        setReplyTo(null);
        return;
      }
      e.preventDefault();
      router.push("/chats");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleting, selected, editing, replyTo, showClearConfirm, showDeleteChatConfirm, router]);

  const onContextMenu = useCallback(
    (id: string, x: number, y: number) => {
      const m = messages.find((mm) => mm.id === id);
      if (!m) return;
      setSelected({ message: m, x, y });
    },
    [messages]
  );

  const onAction = useCallback(
    (action: MessageAction, m: Message) => {
      switch (action) {
        case "reply":
          setEditing(null);
          setReplyTo(m);
          break;
        case "copy":
          if (m.kind === "voice") return;
          void navigator.clipboard?.writeText(m.text).catch(() => undefined);
          break;
        case "edit":
          if (m.senderId !== me?.id || m.kind !== "text") return;
          setReplyTo(null);
          setEditing(m);
          break;
        case "delete":
          setDeleting(m);
          break;
      }
    },
    [me?.id]
  );

  const onSend = useCallback(
    async (text: string, opts: { replyToId?: string | null; editId?: string | null }) => {
      await sendMessage(chatId, text, opts);
      setEditing(null);
      setReplyTo(null);
    },
    [chatId, sendMessage]
  );

  const onSendVoice = useCallback(
    async (dataUrl: string, durationSec: number) => {
      await sendVoiceMessage(chatId, {
        attachmentDataUrl: dataUrl,
        durationSec,
        replyToId: replyTo?.id ?? null,
      });
      setReplyTo(null);
    },
    [chatId, replyTo?.id, sendVoiceMessage]
  );

  const onConfirmDelete = useCallback(
    async (forEveryone: boolean) => {
      if (!deleting) return;
      await deleteMessage(chatId, deleting.id, forEveryone);
      setDeleting(null);
    },
    [chatId, deleteMessage, deleting]
  );

  const onConfirmClear = useCallback(async () => {
    await clearChat(chatId);
    setShowClearConfirm(false);
  }, [chatId, clearChat]);

  const onConfirmDeleteChat = useCallback(async () => {
    await deleteChat(chatId);
    setShowDeleteChatConfirm(false);
    router.push("/chats");
  }, [chatId, deleteChat, router]);

  if (!me) return null;

  if (!chat && chatsLoaded) {
    return (
      <div className="flex-1 grid place-items-center text-muted text-sm">Чат не найден.</div>
    );
  }

  const other = chat?.otherUser;
  const typing = chat && other ? !!typingByChat[chatId]?.has(other.id) : false;
  const loading = !!messagesLoading[chatId];

  const replyAuthorName =
    replyTo && (replyTo.senderId === me.id ? "Вы" : other?.displayName ?? "Собеседник");

  const canEdit = !!selected && selected.message.senderId === me.id && selected.message.kind === "text";

  return (
    <>
      <header className="h-16 shrink-0 border-b border-border bg-bg-panel flex items-center gap-3 px-3 pr-2">
        {other ? (
          <Link
            href={`/users/${other.id}`}
            className="flex items-center gap-3 min-w-0 flex-1 rounded-md hover:bg-bg-hover px-2 py-1 transition-colors"
          >
            <Avatar
              name={other.displayName}
              url={other.avatarUrl}
              size="sm"
              online={chat?.otherUserIsOnline}
            />
            <div className="min-w-0">
              <div className="font-medium truncate">{other.displayName}</div>
              <ChatStatus
                typing={typing}
                online={!!chat?.otherUserIsOnline}
                lastSeenAt={other.lastSeenAt}
              />
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 flex-1">
            <Avatar name="?" size="sm" />
            <div className="text-muted text-sm">…</div>
          </div>
        )}

        <ChatHeaderMenu
          onClearHistory={() => setShowClearConfirm(true)}
          onDeleteChat={() => setShowDeleteChatConfirm(true)}
        />
      </header>

      <MessageList
        messages={messages}
        selfId={me.id}
        loading={loading}
        otherLastReadAt={chat?.otherUserLastReadAt ?? null}
        selectedId={selected?.message.id ?? null}
        onContextMenu={onContextMenu}
      />

      <MessageInput
        chatId={chatId}
        disabled={!chat}
        editing={editing}
        replyTo={replyTo}
        replyToAuthorName={replyAuthorName ?? undefined}
        onCancelEditing={() => setEditing(null)}
        onCancelReply={() => setReplyTo(null)}
        onSend={onSend}
        onSendVoice={onSendVoice}
      />

      {selected && (
        <MessageActionsMenu
          isMine={selected.message.senderId === me.id}
          canEdit={canEdit}
          x={selected.x}
          y={selected.y}
          onAction={(action) => onAction(action, selected.message)}
          onClose={() => setSelected(null)}
        />
      )}

      {deleting && (
        <DeleteMessageDialog
          message={deleting}
          isMine={deleting.senderId === me.id}
          onCancel={() => setDeleting(null)}
          onConfirm={onConfirmDelete}
        />
      )}

      {showClearConfirm && (
        <ConfirmDialog
          title="Очистить историю?"
          description="Все сообщения в этом чате будут удалены у обоих участников."
          confirmLabel="Очистить"
          destructive
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={onConfirmClear}
        />
      )}

      {showDeleteChatConfirm && (
        <ConfirmDialog
          title="Удалить чат?"
          description="Чат будет удалён у обоих участников вместе со всеми сообщениями."
          confirmLabel="Удалить"
          destructive
          onCancel={() => setShowDeleteChatConfirm(false)}
          onConfirm={onConfirmDeleteChat}
        />
      )}
    </>
  );
}

function ChatStatus({
  typing,
  online,
  lastSeenAt,
}: {
  typing: boolean;
  online: boolean;
  lastSeenAt: string | null;
}) {
  if (typing) {
    return (
      <div className="text-xs text-accent flex items-center gap-1.5">
        <span>печатает</span>
        <span className="flex items-end gap-0.5 leading-none">
          <span className="typing-dot inline-block h-1 w-1 rounded-full bg-accent" />
          <span className="typing-dot inline-block h-1 w-1 rounded-full bg-accent" />
          <span className="typing-dot inline-block h-1 w-1 rounded-full bg-accent" />
        </span>
      </div>
    );
  }
  if (online) {
    return <div className="text-xs text-accent truncate">в сети</div>;
  }
  return <div className="text-xs text-muted truncate">{lastSeenLabel(lastSeenAt)}</div>;
}
