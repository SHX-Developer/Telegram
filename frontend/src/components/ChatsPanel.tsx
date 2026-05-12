"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SearchBar } from "./SearchBar";
import { ChatListItem } from "./ChatListItem";
import { Avatar } from "./Avatar";
import { useChatsStore } from "@/store/chats";
import { useAuthStore } from "@/store/auth";
import { searchUsers } from "@/lib/users";
import { createPrivateChat } from "@/lib/chats";
import type { User } from "@/lib/types";

export function ChatsPanel() {
  const router = useRouter();
  const params = useParams();
  const activeChatId = (params?.chatId as string | undefined) ?? null;

  const me = useAuthStore((s) => s.user);
  const { chats, chatsLoading, chatsLoaded, fetchChats, upsertChatFromPrivate } = useChatsStore();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

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

  return (
    <>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold">Chats</h1>
      </div>
      <SearchBar value={query} onChange={setQuery} onClear={() => setQuery("")} />

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
          />
        )}
      </div>
    </>
  );
}

function ChatsView({
  chatsLoaded,
  chatsLoading,
  chats,
  activeChatId,
  selfId,
}: {
  chatsLoaded: boolean;
  chatsLoading: boolean;
  chats: ReturnType<typeof useChatsStore.getState>["chats"];
  activeChatId: string | null;
  selfId: string;
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
        <ChatListItem key={c.id} chat={c} active={c.id === activeChatId} selfId={selfId} />
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
