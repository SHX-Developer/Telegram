"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { SearchBar } from "./SearchBar";
import { ChatListItem } from "./ChatListItem";
import { Avatar } from "./Avatar";
import { CreateChatDialog } from "./CreateChatDialog";
import { ChatContextMenu, type ChatContextAction } from "./ChatContextMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { useChatsStore } from "@/store/chats";
import { useAuthStore } from "@/store/auth";
import { searchUsers } from "@/lib/users";
import { createPrivateChat } from "@/lib/chats";
import type { Chat, User } from "@/lib/types";

export function ChatsPanel() {
  const router = useRouter();
  const params = useParams();
  const activeChatId = (params?.chatId as string | undefined) ?? null;

  const me = useAuthStore((s) => s.user);
  const { chats, chatsLoading, chatsLoaded, fetchChats, upsertChatFromPrivate } = useChatsStore();

  const togglePinChat = useChatsStore((s) => s.togglePinChat);
  const deleteChat = useChatsStore((s) => s.deleteChat);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ chat: Chat; x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Chat | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  // Загрузить чаты при монтировании
  useEffect(() => {
    if (!chatsLoaded) void fetchChats();
  }, [chatsLoaded, fetchChats]);

  // Дебаунс поискового запроса
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchUsers(q)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function openChatWith(user: User) {
    setOpening(user.id);
    try {
      const chat = await createPrivateChat(user.id);
      upsertChatFromPrivate(chat);
      setQuery("");
      router.push(`/chats/${chat.id}`);
    } finally {
      setOpening(null);
    }
  }

  function onCreated(chat: Chat) {
    upsertChatFromPrivate(chat);
    setCreating(false);
    router.push(`/chats/${chat.id}`);
  }

  async function onCtxAction(action: ChatContextAction) {
    if (!ctxMenu) return;
    const chat = ctxMenu.chat;
    setCtxMenu(null);
    if (action === "pin" || action === "unpin") {
      setPinError(null);
      try {
        await togglePinChat(chat.id, action === "pin");
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setPinError(err.response?.data?.error ?? "Не удалось");
        } else {
          setPinError("Не удалось");
        }
        setTimeout(() => setPinError(null), 3000);
      }
    } else if (action === "delete") {
      setConfirmDelete(chat);
    }
  }

  async function onConfirmDelete() {
    if (!confirmDelete) return;
    await deleteChat(confirmDelete.id);
    setConfirmDelete(null);
  }

  return (
    <>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Chats</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="New chat"
          title="Создать группу или канал"
          className="h-8 w-8 grid place-items-center rounded-full text-muted hover:text-white hover:bg-bg-hover transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M16 4l4 4-11 11H5v-4L16 4z" strokeLinejoin="round" />
            <path d="M14 6l4 4" />
          </svg>
        </button>
      </div>
      <SearchBar value={query} onChange={setQuery} onClear={() => setQuery("")} />
      {creating && (
        <CreateChatDialog onCancel={() => setCreating(false)} onCreated={onCreated} />
      )}

      {pinError && (
        <div className="mx-3 mb-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {pinError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-3">
        {query.trim() ? (
          <SearchView
            users={searchResults}
            loading={searching}
            opening={opening}
            onOpen={openChatWith}
          />
        ) : (
          <ChatsView
            chatsLoaded={chatsLoaded}
            chatsLoading={chatsLoading}
            chats={chats}
            activeChatId={activeChatId}
            selfId={me?.id ?? ""}
            onContextMenu={(chat, x, y) => setCtxMenu({ chat, x, y })}
          />
        )}
      </div>

      {ctxMenu && (
        <ChatContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          isPinned={ctxMenu.chat.isPinned}
          onAction={onCtxAction}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить чат?"
          description="Чат и история будут удалены."
          confirmLabel="Удалить"
          destructive
          onCancel={() => setConfirmDelete(null)}
          onConfirm={onConfirmDelete}
        />
      )}
    </>
  );
}

function ChatsView({
  chatsLoaded,
  chatsLoading,
  chats,
  activeChatId,
  selfId,
  onContextMenu,
}: {
  chatsLoaded: boolean;
  chatsLoading: boolean;
  chats: ReturnType<typeof useChatsStore.getState>["chats"];
  activeChatId: string | null;
  selfId: string;
  onContextMenu: (chat: Chat, x: number, y: number) => void;
}) {
  if (!chatsLoaded && chatsLoading) {
    return <div className="px-4 py-6 text-sm text-muted">Загружаю чаты…</div>;
  }
  if (chats.length === 0) {
    return (
      <div className="px-5 py-10 text-sm text-muted text-center">
        Чатов пока нет.
        <br />
        Найди кого-нибудь через поиск.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {chats.map((c) => (
        <ChatListItem
          key={c.id}
          chat={c}
          active={c.id === activeChatId}
          selfId={selfId}
          onContextMenu={(x, y) => onContextMenu(c, x, y)}
        />
      ))}
    </div>
  );
}

function SearchView({
  users,
  loading,
  opening,
  onOpen,
}: {
  users: User[];
  loading: boolean;
  opening: string | null;
  onOpen: (u: User) => void;
}) {
  if (loading && users.length === 0) {
    return <div className="px-4 py-6 text-sm text-muted">Ищу…</div>;
  }
  if (!loading && users.length === 0) {
    return <div className="px-4 py-6 text-sm text-muted">Никого не нашли.</div>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-4 py-1.5 text-xs uppercase tracking-wider text-muted">
        Пользователи
      </div>
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          disabled={opening === u.id}
          onClick={() => onOpen(u)}
          className="flex items-center gap-3 px-3 py-2.5 mx-1.5 rounded-lg text-left hover:bg-bg-hover disabled:opacity-60"
        >
          <Avatar name={u.displayName} url={u.avatarUrl} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{u.displayName}</div>
            <div className="text-sm text-muted truncate">@{u.username}</div>
          </div>
          {opening === u.id && <span className="text-xs text-muted">…</span>}
        </button>
      ))}
    </div>
  );
}
