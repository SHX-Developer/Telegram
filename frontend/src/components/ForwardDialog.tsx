"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Avatar } from "./Avatar";
import { useChatsStore } from "@/store/chats";
import { useAuthStore } from "@/store/auth";
import { chatDisplayName, canPostInChat } from "@/lib/permissions";
import type { Message } from "@/lib/types";

interface Props {
  message: Message;
  fromChatId: string;
  onCancel: () => void;
  onForwarded: () => void;
}

export function ForwardDialog({ message, fromChatId, onCancel, onForwarded }: Props) {
  const me = useAuthStore((s) => s.user);
  const chats = useChatsStore((s) => s.chats);
  const forwardMessage = useChatsStore((s) => s.forwardMessage);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Чаты в которые можно постить (исключаем сам исходный)
  const available = chats.filter(
    (c) => c.id !== fromChatId && canPostInChat(c)
  );
  const q = query.trim().toLowerCase();
  const filtered = q
    ? available.filter((c) => {
        const name = chatDisplayName(c).toLowerCase();
        const uname = (c.otherUser?.username ?? "").toLowerCase();
        return name.includes(q) || uname.includes(q);
      })
    : available;

  function toggle(chatId: string) {
    const next = new Set(selected);
    if (next.has(chatId)) next.delete(chatId);
    else next.add(chatId);
    setSelected(next);
  }

  async function submit() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      await forwardMessage(fromChatId, message.id, Array.from(selected));
      onForwarded();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Не удалось переслать");
      } else {
        setError("Не удалось переслать");
      }
    } finally {
      setSending(false);
    }
  }

  if (!me) return null;

  const previewText =
    message.deletedAt
      ? "Сообщение удалено"
      : message.kind === "voice"
      ? `🎤 Голосовое (${message.attachmentDurationSec ?? 0}c)`
      : message.kind === "file"
      ? `📎 ${message.attachmentName ?? "Файл"}`
      : message.text;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm dialog-fade p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="dialog-pop w-full max-w-md rounded-2xl glass-strong shadow-glass max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h2 className="text-lg font-semibold">Переслать сообщение</h2>
          <div className="mt-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-xs text-muted truncate">
            {previewText}
          </div>
        </div>

        <div className="px-5 py-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск чата"
            className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
            autoFocus
          />
        </div>

        <div className="px-2 pb-2 overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              {q ? "Ничего не найдено" : "Нет доступных чатов"}
            </div>
          ) : (
            filtered.map((c) => {
              const name = chatDisplayName(c);
              const url =
                c.type === "private" ? c.otherUser?.avatarUrl : c.avatarUrl;
              const isSelected = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`flex items-center gap-3 w-full p-2 mx-1 rounded-lg text-left transition-colors ${
                    isSelected ? "bg-accent/20" : "hover:bg-bg-hover"
                  }`}
                >
                  <Avatar name={name} url={url} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{name}</div>
                    <div className="text-xs text-muted truncate">
                      {c.type === "private"
                        ? c.otherUser?.username
                          ? `@${c.otherUser.username}`
                          : "Личный чат"
                        : c.type === "channel"
                        ? "Канал"
                        : "Группа"}
                    </div>
                  </div>
                  {isSelected && <span className="text-accent">✓</span>}
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="mx-5 mb-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="border-t border-border px-5 py-3 flex justify-between items-center">
          <div className="text-xs text-muted">
            {selected.size > 0 ? `Выбрано: ${selected.size}` : "Выбери чаты"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={sending}
              className="rounded-lg px-4 py-1.5 text-sm hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={sending || selected.size === 0}
              className="rounded-lg px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
            >
              {sending ? "Пересылаю…" : "Переслать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
