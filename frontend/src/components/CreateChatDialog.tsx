"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Avatar } from "./Avatar";
import { searchUsers } from "@/lib/users";
import { createGroupChat, createChannelChat } from "@/lib/chats";
import { fileToResizedDataUrl } from "@/lib/image";
import type { Chat, User } from "@/lib/types";

interface Props {
  onCancel: () => void;
  onCreated: (chat: Chat) => void;
}

type Mode = "group" | "channel";

export function CreateChatDialog({ onCancel, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>("group");
  const [title, setTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Esc → отмена
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  // Поиск пользователей с debounce
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchUsers(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function toggleUser(u: User) {
    setSelected((s) =>
      s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]
    );
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setAvatarBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToResizedDataUrl(f, { maxSize: 256, quality: 0.85 });
      setAvatarUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить аватар");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        avatarUrl,
        memberIds: selected.map((u) => u.id),
      };
      const chat =
        mode === "group" ? await createGroupChat(payload) : await createChannelChat(payload);
      onCreated(chat);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Не удалось создать");
      } else {
        setError("Не удалось создать");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm dialog-fade p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="dialog-pop w-full max-w-md rounded-2xl glass-strong shadow-glass max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h2 className="text-lg font-semibold">
            Новый {mode === "group" ? "групповой чат" : "канал"}
          </h2>
          <div className="mt-3 inline-flex rounded-lg bg-bg-elevated p-1">
            <button
              type="button"
              onClick={() => setMode("group")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                mode === "group" ? "bg-accent text-white" : "text-muted hover:text-white"
              }`}
            >
              Группа
            </button>
            <button
              type="button"
              onClick={() => setMode("channel")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                mode === "channel" ? "bg-accent text-white" : "text-muted hover:text-white"
              }`}
            >
              Канал
            </button>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              className="group relative outline-none rounded-full disabled:opacity-60"
              aria-label="Загрузить аватар"
            >
              <Avatar name={title || "?"} url={avatarUrl} size="lg" />
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors grid place-items-center text-[10px] text-white opacity-0 group-hover:opacity-100">
                {avatarBusy ? "…" : "Изменить"}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                Название
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={64}
                placeholder={mode === "group" ? "Моя команда" : "Мой канал"}
                className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
                required
              />
            </div>
          </div>

          <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
            Добавить участников {mode === "channel" && "(подписчиков)"}
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или @username"
            className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
          />

          {selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u)}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-accent/20 text-accent text-xs hover:bg-accent/30 transition-colors"
                >
                  <Avatar name={u.displayName} url={u.avatarUrl} size="sm" />
                  <span>{u.displayName}</span>
                  <span className="text-base leading-none">×</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 max-h-56 overflow-y-auto">
            {searching && results.length === 0 && (
              <div className="text-xs text-muted px-1 py-2">Ищу…</div>
            )}
            {!searching && query.trim() && results.length === 0 && (
              <div className="text-xs text-muted px-1 py-2">Никого не нашли</div>
            )}
            {results.map((u) => {
              const isSelected = selected.some((x) => x.id === u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u)}
                  className={`flex items-center gap-3 w-full px-2 py-1.5 rounded-lg text-left transition-colors ${
                    isSelected ? "bg-accent/20" : "hover:bg-bg-hover"
                  }`}
                >
                  <Avatar name={u.displayName} url={u.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{u.displayName}</div>
                    <div className="text-xs text-muted truncate">@{u.username}</div>
                  </div>
                  {isSelected && <span className="text-accent">✓</span>}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={creating}
            className="rounded-lg px-4 py-1.5 text-sm hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="rounded-lg px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
          >
            {creating ? "Создаю…" : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
}
