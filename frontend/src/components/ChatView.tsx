"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { MessageActionsMenu, type MessageAction } from "./MessageActionsMenu";
import { ReactionPicker } from "./ReactionPicker";
import { DeleteMessageDialog } from "./DeleteMessageDialog";
import { ChatHeaderMenu } from "./ChatHeaderMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { ChatInfoPanel } from "./ChatInfoPanel";
import { ForwardDialog } from "./ForwardDialog";
import { useChatsStore } from "@/store/chats";
import { useAuthStore } from "@/store/auth";
import { getSocket } from "@/lib/socket";
import { canPostInChat, canManageChat, chatDisplayName } from "@/lib/permissions";
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
    sendFileMessage,
    deleteMessage,
    fetchChats,
    chatsLoaded,
    typingByChat,
    resetTyping,
    clearChat,
    deleteChat,
    setReaction,
    markMessageView,
    togglePinMessage,
  } = useChatsStore();

  const chat = useMemo(() => chats.find((c) => c.id === chatId), [chats, chatId]);
  const messages = messagesByChat[chatId] ?? [];
  const isChannel = chat?.type === "channel";
  const isPrivate = chat?.type === "private";
  const canPost = canPostInChat(chat);

  const [selected, setSelected] = useState<SelectedMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<SelectedMessage | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelected(null);
    setReactionPickerFor(null);
    setEditing(null);
    setReplyTo(null);
    setDeleting(null);
    setForwarding(null);
    setShowClearConfirm(false);
    setShowDeleteChatConfirm(false);
    setHighlightId(null);
    setInfoOpen(false);
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.isComposing) return;
      if (deleting || showClearConfirm || showDeleteChatConfirm || selected || reactionPickerFor) return;
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
      if (infoOpen) {
        e.preventDefault();
        setInfoOpen(false);
        return;
      }
      e.preventDefault();
      router.push("/chats");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    deleting,
    selected,
    editing,
    replyTo,
    showClearConfirm,
    showDeleteChatConfirm,
    reactionPickerFor,
    infoOpen,
    router,
  ]);

  const onContextMenu = useCallback(
    (id: string, x: number, y: number) => {
      const m = messages.find((mm) => mm.id === id);
      if (!m) return;
      setSelected({ message: m, x, y });
    },
    [messages]
  );

  const onJumpToMessage = useCallback((id: string) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightId(null);
    requestAnimationFrame(() => setHighlightId(id));
    highlightTimerRef.current = setTimeout(() => setHighlightId(null), 2100);
  }, []);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    []
  );

  const onAction = useCallback(
    (action: MessageAction, m: Message, coords: { x: number; y: number }) => {
      switch (action) {
        case "forward":
          setForwarding(m);
          break;
        case "pin":
          void togglePinMessage(m.chatId, m.id, true);
          break;
        case "unpin":
          void togglePinMessage(m.chatId, m.id, false);
          break;
        case "react":
          // Если у меня уже есть реакция — снять, иначе показать пикер.
          {
            const my = m.reactions.find((r) => r.byMe);
            if (my) {
              void setReaction(m.chatId, m.id, null);
            } else {
              setReactionPickerFor({ message: m, x: coords.x, y: coords.y });
            }
          }
          break;
        case "reply":
          setEditing(null);
          setReplyTo(m);
          break;
        case "copy":
          if (m.kind !== "text") return;
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
    [me?.id, setReaction, togglePinMessage]
  );

  const onToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      const m = messages.find((x) => x.id === messageId);
      if (!m) return;
      const my = m.reactions.find((r) => r.byMe);
      if (my && my.emoji === emoji) {
        void setReaction(chatId, messageId, null);
      } else {
        void setReaction(chatId, messageId, emoji);
      }
    },
    [chatId, messages, setReaction]
  );

  const onMessageVisible = useCallback(
    (messageId: string) => {
      if (!isChannel) return;
      void markMessageView(chatId, messageId);
    },
    [chatId, isChannel, markMessageView]
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

  const onSendFile = useCallback(
    async (payload: { dataUrl: string; name: string; mime: string; size: number }) => {
      await sendFileMessage(chatId, {
        attachmentDataUrl: payload.dataUrl,
        attachmentName: payload.name,
        attachmentMime: payload.mime,
        attachmentSize: payload.size,
        replyToId: replyTo?.id ?? null,
      });
      setReplyTo(null);
    },
    [chatId, replyTo?.id, sendFileMessage]
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
  const typing =
    chat && other ? !!typingByChat[chatId]?.has(other.id) : false;
  const loading = !!messagesLoading[chatId];

  const replyAuthorName =
    replyTo && (replyTo.senderId === me.id ? "Вы" : other?.displayName ?? "");

  const canEdit =
    !!selected && selected.message.senderId === me.id && selected.message.kind === "text";
  const canCopy = !!selected && selected.message.kind === "text";
  // pin: в private — оба участника, в group/channel — только owner/admin
  const canPin =
    !!chat &&
    (chat.type === "private" ? true : canManageChat(chat));
  const isMessagePinned =
    !!selected && chat?.pinnedMessage?.id === selected.message.id;

  const title = chatDisplayName(chat);
  const headerAvatarUrl = isPrivate ? other?.avatarUrl : chat?.avatarUrl;
  const headerOnline = isPrivate ? chat?.otherUserIsOnline : false;
  const headerHref = isPrivate ? (other ? `/users/${other.id}` : null) : null;

  return (
    <>
      <header className="h-16 shrink-0 border-b border-border bg-bg-panel flex items-center gap-3 px-3 pr-2">
          {chat && headerHref ? (
            <Link
              href={headerHref}
              className="flex items-center gap-3 min-w-0 flex-1 rounded-md hover:bg-bg-hover px-2 py-1 transition-colors"
            >
              <Avatar name={title} url={headerAvatarUrl} size="sm" online={headerOnline} />
              <div className="min-w-0">
                <div className="font-medium truncate">{title}</div>
                <ChatStatus
                  typing={typing}
                  online={!!headerOnline}
                  lastSeenAt={other?.lastSeenAt ?? null}
                />
              </div>
            </Link>
          ) : chat ? (
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="flex items-center gap-3 min-w-0 flex-1 rounded-md hover:bg-bg-hover px-2 py-1 transition-colors text-left"
            >
              <Avatar name={title} url={headerAvatarUrl} size="sm" />
              <div className="min-w-0">
                <div className="font-medium truncate">{title}</div>
                <div className="text-xs text-muted truncate">
                  {chat.type === "channel" ? "Канал" : "Группа"} · {chat.members.length}{" "}
                  {chat.members.length === 1 ? "участник" : "участников"}
                </div>
              </div>
            </button>
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

      {chat?.pinnedMessage && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onJumpToMessage(chat.pinnedMessage!.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onJumpToMessage(chat.pinnedMessage!.id);
            }
          }}
          className="border-b border-border bg-white/[0.04] hover:bg-white/[0.08] transition-colors px-4 py-2 text-left flex items-center gap-3"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M12 2v8h6l-2 4H8l-2-4h6V2zm0 12v8" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-accent">
              Закреплённое сообщение
            </div>
            <div className="text-xs text-muted truncate">
              {chat.pinnedMessage.kind === "voice"
                ? `🎤 Голосовое (${chat.pinnedMessage.attachmentDurationSec ?? 0}c)`
                : chat.pinnedMessage.kind === "file"
                ? `📎 ${chat.pinnedMessage.attachmentName ?? "Файл"}`
                : chat.pinnedMessage.text}
            </div>
          </div>
          {canPin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (chat.pinnedMessage)
                  void togglePinMessage(chatId, chat.pinnedMessage.id, false);
              }}
              aria-label="Открепить"
              className="h-7 w-7 grid place-items-center rounded-full text-muted hover:text-white hover:bg-bg-hover"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      )}

      <MessageList
          messages={messages}
          selfId={me.id}
          loading={loading}
          otherLastReadAt={chat?.otherUserLastReadAt ?? null}
          selectedId={selected?.message.id ?? null}
          highlightId={highlightId}
          isChannel={!!isChannel}
          onContextMenu={onContextMenu}
          onJumpToMessage={onJumpToMessage}
          onToggleReaction={onToggleReaction}
          onMessageVisible={onMessageVisible}
        />

        {canPost ? (
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
            onSendFile={onSendFile}
          />
        ) : (
          <div className="border-t border-border bg-bg-panel px-6 py-4 text-center text-sm text-muted">
            Только владельцы и админы могут публиковать в канале.
          </div>
        )}

        {selected && (
          <MessageActionsMenu
            isMine={selected.message.senderId === me.id}
            canEdit={canEdit}
            canCopy={canCopy}
            canPin={canPin}
            isPinned={isMessagePinned}
            x={selected.x}
            y={selected.y}
            onAction={(action) =>
              onAction(action, selected.message, { x: selected.x, y: selected.y })
            }
            onClose={() => setSelected(null)}
          />
        )}

        {reactionPickerFor && (
          <ReactionPicker
            x={reactionPickerFor.x}
            y={reactionPickerFor.y}
            isMine={reactionPickerFor.message.senderId === me.id}
            onPick={(emoji) => {
              void setReaction(chatId, reactionPickerFor.message.id, emoji);
              setReactionPickerFor(null);
            }}
            onClose={() => setReactionPickerFor(null)}
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
            description="Все сообщения будут удалены."
            confirmLabel="Очистить"
            destructive
            onCancel={() => setShowClearConfirm(false)}
            onConfirm={onConfirmClear}
          />
        )}

        {showDeleteChatConfirm && (
          <ConfirmDialog
            title="Удалить чат?"
            description="Чат и история будут удалены у всех участников."
            confirmLabel="Удалить"
            destructive
            onCancel={() => setShowDeleteChatConfirm(false)}
            onConfirm={onConfirmDeleteChat}
          />
        )}

      {forwarding && (
        <ForwardDialog
          message={forwarding}
          fromChatId={chatId}
          onCancel={() => setForwarding(null)}
          onForwarded={() => setForwarding(null)}
        />
      )}

      {chat && !isPrivate && infoOpen && (
        <ChatInfoPanel chat={chat} onClose={() => setInfoOpen(false)} />
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
