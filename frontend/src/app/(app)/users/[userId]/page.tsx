"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Avatar } from "@/components/Avatar";
import { useAuthStore } from "@/store/auth";
import { useChatsStore } from "@/store/chats";
import {
  getUser,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getContacts,
  addContact,
  removeContact,
} from "@/lib/users";
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

function formatDateTime(iso: string | null): string {
  if (!iso) return "Скрыто или не указано";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "Не указано";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fieldValue(value: string | null): string {
  return value && value.trim() ? value : "Не указано";
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
  const [isBlocked, setIsBlocked] = useState(false);
  const [busyBlock, setBusyBlock] = useState(false);
  const [isContact, setIsContact] = useState(false);
  const [busyContact, setBusyContact] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getUser(userId),
      getBlockedUsers().catch(() => [] as User[]),
      getContacts().catch(() => [] as User[]),
    ])
      .then(([u, blocked, contacts]) => {
        if (!alive) return;
        setUser(u);
        setIsBlocked(blocked.some((b) => b.id === u.id));
        setIsContact(contacts.some((c) => c.id === u.id));
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

  async function onToggleBlock() {
    if (!user) return;
    setBusyBlock(true);
    try {
      if (isBlocked) {
        await unblockUser(user.id);
        setIsBlocked(false);
      } else {
        await blockUser(user.id);
        setIsBlocked(true);
      }
    } finally {
      setBusyBlock(false);
    }
  }

  async function onToggleContact() {
    if (!user) return;
    setBusyContact(true);
    try {
      if (isContact) {
        await removeContact(user.id);
        setIsContact(false);
      } else {
        await addContact(user.id);
        setIsContact(true);
      }
    } finally {
      setBusyContact(false);
    }
  }

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
  const profileRows = [
    ["ID", user.id],
    ["Имя профиля", user.displayName],
    ["Username", user.username ? `@${user.username}` : "Не указано"],
    ["Имя", fieldValue(user.firstName)],
    ["Фамилия", fieldValue(user.lastName)],
    ["Телефон", user.phoneNumber ?? (isMe ? "Не указано" : "Скрыто")],
    ["О себе", user.bio ?? "Скрыто или не указано"],
    ["Дата рождения", formatDate(user.birthday)],
    ["Последний онлайн", online ? "в сети" : formatDateTime(user.lastSeenAt)],
    ["Дата регистрации", formatDateTime(user.createdAt)],
    ["Аватар", user.avatarUrl ? "Есть" : "Нет или скрыт"],
  ];

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
        <div className="text-muted">
          {user.username ? `@${user.username}` : "username не указан"}
        </div>

        <div className="mt-1 text-sm">
          {online ? (
            <span className="text-accent">в сети</span>
          ) : (
            <span className="text-muted">{lastSeenLabel(user.lastSeenAt)}</span>
          )}
        </div>

        {!isMe && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              onClick={openChat}
              disabled={opening || isBlocked}
              className="rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors px-6 py-2.5 text-sm font-medium"
            >
              {opening ? "Открываю…" : isBlocked ? "Юзер заблокирован" : "Написать сообщение"}
            </button>
            <button
              onClick={onToggleContact}
              disabled={busyContact}
              className="rounded-full px-6 py-2 text-sm font-medium bg-bg-elevated hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              {busyContact
                ? "…"
                : isContact
                ? "Удалить из контактов"
                : "Добавить в контакты"}
            </button>
            <button
              onClick={onToggleBlock}
              disabled={busyBlock}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                isBlocked
                  ? "bg-bg-elevated hover:bg-bg-hover text-white"
                  : "bg-bg-elevated hover:bg-red-500/20 text-red-400"
              }`}
            >
              {busyBlock ? "…" : isBlocked ? "Разблокировать" : "Заблокировать"}
            </button>
          </div>
        )}
        {isMe && (
          <div className="mt-8 text-xs text-muted">
            Это ваш профиль. Редактировать его можно во вкладке Profile слева.
          </div>
        )}

        <section className="mt-8 w-full rounded-lg border border-border bg-bg-panel text-left overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-medium">
            Данные профиля
          </div>
          <div className="divide-y divide-border/70">
            {profileRows.map(([label, value]) => (
              <div key={label} className="px-4 py-3 grid grid-cols-[130px_1fr] gap-3 text-sm">
                <div className="text-muted">{label}</div>
                <div className="min-w-0 break-words text-white">{value}</div>
              </div>
            ))}
          </div>
        </section>
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
