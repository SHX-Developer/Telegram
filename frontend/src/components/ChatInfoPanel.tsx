"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { Avatar } from "./Avatar";
import { ConfirmDialog } from "./ConfirmDialog";
import { useChatsStore } from "@/store/chats";
import { useAuthStore } from "@/store/auth";
import { canManageChat, canDeleteChat } from "@/lib/permissions";
import { fileToResizedDataUrl } from "@/lib/image";
import {
  updateChat,
  addChatMembers,
  removeChatMember,
} from "@/lib/chats";
import { searchUsers } from "@/lib/users";
import type { Chat, User } from "@/lib/types";

interface Props {
  chat: Chat;
  onClose: () => void;
}

export function ChatInfoPanel({ chat, onClose }: Props) {
  const me = useAuthStore((s) => s.user);
  const refetchChat = useChatsStore((s) => s.refetchChat);
  const deleteChat = useChatsStore((s) => s.deleteChat);

  const [title, setTitle] = useState(chat.title ?? "");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<User[]>([]);
  const [addBusy, setAddBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(chat.title ?? "");
  }, [chat.id, chat.title]);

  useEffect(() => {
    const q = addQuery.trim();
    if (!q) {
      setAddResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(q)
        .then((users) => {
          const memberIds = new Set(chat.members.map((m) => m.userId));
          setAddResults(users.filter((u) => !memberIds.has(u.id)));
        })
        .catch(() => setAddResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [addQuery, chat.members]);

  const manage = canManageChat(chat);
  const canDelete = canDeleteChat(chat);

  async function onSaveTitle(e: FormEvent) {
    e.preventDefault();
    if (!manage || title.trim() === chat.title) return;
    setSavingTitle(true);
    setError(null);
    try {
      await updateChat(chat.id, { title: title.trim() });
      await refetchChat(chat.id);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Не удалось");
      else setError("Не удалось");
    } finally {
      setSavingTitle(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !manage) return;
    setSavingAvatar(true);
    setError(null);
    try {
      const dataUrl = await fileToResizedDataUrl(f, { maxSize: 256, quality: 0.85 });
      await updateChat(chat.id, { avatarUrl: dataUrl });
      await refetchChat(chat.id);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSavingAvatar(false);
    }
  }

  async function onAddMember(u: User) {
    setAddBusy(true);
    setError(null);
    try {
      await addChatMembers(chat.id, [u.id]);
      await refetchChat(chat.id);
      setAddQuery("");
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Не удалось");
    } finally {
      setAddBusy(false);
    }
  }

  async function onRemoveMember(userId: string) {
    setError(null);
    try {
      await removeChatMember(chat.id, userId);
      await refetchChat(chat.id);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Не удалось");
    }
  }

  async function onConfirmDelete() {
    await deleteChat(chat.id);
    setShowDelete(false);
    onClose();
  }

  return (
    <>
      {/* Backdrop — закрывает по клику снаружи */}
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 dialog-fade"
      />
      <aside className="fixed top-0 right-0 z-50 h-screen w-[360px] max-w-full border-l border-border bg-bg-panel flex flex-col info-panel-slide">
      <header className="h-16 shrink-0 border-b border-border flex items-center justify-between px-4">
        <div className="font-medium">
          {chat.type === "channel" ? "О канале" : "О группе"}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-8 w-8 grid place-items-center rounded-full text-muted hover:text-white hover:bg-bg-hover"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="overflow-y-auto">
        <div className="px-5 pt-5 pb-3 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => manage && fileRef.current?.click()}
            disabled={!manage || savingAvatar}
            className="group relative outline-none rounded-full disabled:cursor-default"
          >
            <Avatar name={chat.title ?? "?"} url={chat.avatarUrl} size="xl" />
            {manage && (
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors grid place-items-center text-xs text-white opacity-0 group-hover:opacity-100">
                {savingAvatar ? "…" : "Изменить"}
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickAvatar}
          />
          <div className="mt-3 text-lg font-semibold">{chat.title}</div>
          <div className="text-xs text-muted">
            {chat.type === "channel" ? "Канал" : "Группа"} · {chat.members.length}{" "}
            {chat.members.length === 1 ? "участник" : "участников"}
          </div>
        </div>

        {manage && (
          <form onSubmit={onSaveTitle} className="px-5 py-3 border-t border-border">
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              Название
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={64}
              className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
            />
            {title.trim() && title.trim() !== chat.title && (
              <button
                type="submit"
                disabled={savingTitle}
                className="mt-2 w-full rounded-lg bg-accent hover:bg-accent-hover transition-colors py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {savingTitle ? "Сохраняю…" : "Сохранить"}
              </button>
            )}
          </form>
        )}

        <div className="px-5 py-3 border-t border-border">
          <div className="text-xs uppercase tracking-wider text-muted mb-1.5">Участники</div>
          {chat.members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-3 py-1.5 group"
            >
              <Link
                href={`/users/${m.userId}`}
                className="min-w-0 flex flex-1 items-center gap-3 rounded-lg -mx-1 px-1 py-1 hover:bg-bg-hover transition-colors"
              >
                <Avatar
                  name={m.user.displayName}
                  url={m.user.avatarUrl}
                  size="sm"
                  online={m.isOnline}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {m.user.displayName}
                    {m.userId === me?.id && <span className="text-muted"> (вы)</span>}
                  </div>
                  <div className="text-xs text-muted truncate">
                    @{m.user.username} · {m.role}
                  </div>
                </div>
              </Link>
              {manage && m.userId !== me?.id && m.role !== "owner" && (
                <button
                  type="button"
                  onClick={() => onRemoveMember(m.userId)}
                  aria-label="Remove"
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {manage && (
          <div className="px-5 py-3 border-t border-border">
            <div className="text-xs uppercase tracking-wider text-muted mb-1.5">
              Добавить участника
            </div>
            <input
              type="text"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Поиск..."
              className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
            />
            {addResults.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onAddMember(u)}
                disabled={addBusy}
                className="mt-1 flex items-center gap-3 w-full p-1.5 rounded-lg hover:bg-bg-hover text-left disabled:opacity-50"
              >
                <Avatar name={u.displayName} url={u.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm truncate">{u.displayName}</div>
                  <div className="text-xs text-muted truncate">@{u.username}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mx-5 my-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {canDelete && (
          <div className="px-5 py-3 border-t border-border">
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="w-full rounded-lg bg-bg-elevated hover:bg-red-500/20 transition-colors py-2 text-sm text-red-400"
            >
              Удалить {chat.type === "channel" ? "канал" : "группу"}
            </button>
          </div>
        )}
      </div>

      {showDelete && (
        <ConfirmDialog
          title={`Удалить ${chat.type === "channel" ? "канал" : "группу"}?`}
          description="Чат и вся история будут безвозвратно удалены у всех участников."
          confirmLabel="Удалить"
          destructive
          onCancel={() => setShowDelete(false)}
          onConfirm={onConfirmDelete}
        />
      )}
    </aside>
    </>
  );
}
