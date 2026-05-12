"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Avatar } from "@/components/Avatar";
import { useAuthStore } from "@/store/auth";
import { useChatsStore } from "@/store/chats";
import { getUser } from "@/lib/users";
import { createPrivateChat } from "@/lib/chats";
import type { User } from "@/lib/types";

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "был(а) недавно";
  const d = new Date(iso);
  return `был(а) в сети ${d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function UserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const { chats, otherUserOnline, upsertChatFromPrivate } = useChatsStoreSelected();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getUser(userId)
      .then((u) => {
        if (alive) setUser(u);
      })
      .catch((e) => {
        if (!alive) return;
        if (axios.isAxiosError(e)) {
          setError(e.response?.data?.error ?? "Пользователь не найден");
        } else {
          setError("Пользователь не найден");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (loading) {
    return <div className="flex-1 grid place-items-center text-muted text-sm">Загружаю…</div>;
  }
  if (error || !user) {
    return (
      <div className="flex-1 grid place-items-center text-muted text-sm">
        {error ?? "Пользователь не найден"}
      </div>
    );
  }

  const isMe = me?.id === user.id;
  const existingChat = chats.find((c) => c.otherUser?.id === user.id);
  const online = otherUserOnline(user.id);

  async function openChat() {
    if (!user || isMe) return;
    setOpening(true);
    try {
      const chat = existingChat ?? (await createPrivateChat(user.id));
      upsertChatFromPrivate(chat);
      router.push(`/chats/${chat.id}`);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-16 shrink-0 border-b border-border bg-bg-panel flex items-center gap-3 px-4">
        <Link
          href="/chats"
          className="rounded-md hover:bg-bg-hover px-2 py-1 text-sm text-muted hover:text-white"
        >
          ← Назад
        </Link>
        <div className="text-sm text-muted">Профиль</div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-10 flex flex-col items-center text-center">
        <Avatar name={user.displayName} url={user.avatarUrl} size="xl" online={online} />
        <h1 className="mt-4 text-2xl font-semibold">{user.displayName}</h1>
        <div className="text-muted">@{user.username}</div>

        <div className="mt-1 text-sm">
          {online ? (
            <span className="text-accent">в сети</span>
          ) : (
            <span className="text-muted">{lastSeenLabel(user.lastSeenAt)}</span>
          )}
        </div>

        {!isMe && (
          <button
            onClick={openChat}
            disabled={opening}
            className="mt-8 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors px-6 py-2.5 text-sm font-medium"
          >
            {opening ? "Открываю…" : "Написать сообщение"}
          </button>
        )}
        {isMe && (
          <div className="mt-8 text-xs text-muted">
            Это ваш профиль. Редактировать его можно во вкладке Profile слева.
          </div>
        )}
      </div>
    </div>
  );
}

// Хук, который инкапсулирует селекторы из чат-стора, чтобы избежать
// re-render всей страницы при апдейте любых полей стора.
function useChatsStoreSelected() {
  const chats = useChatsStore((s) => s.chats);
  const upsertChatFromPrivate = useChatsStore((s) => s.upsertChatFromPrivate);

  const otherUserOnline = (userId: string): boolean => {
    return chats.some((c) => c.otherUser?.id === userId && c.otherUserIsOnline);
  };

  return { chats, upsertChatFromPrivate, otherUserOnline };
}
