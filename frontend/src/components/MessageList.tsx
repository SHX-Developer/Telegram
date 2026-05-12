"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { VoiceMessage } from "./VoiceMessage";
import type { Message } from "@/lib/types";

interface Props {
  messages: Message[];
  selfId: string;
  loading: boolean;
  otherLastReadAt: string | null;
  /** ID выделенного через контекстное меню */
  selectedId: string | null;
  /** Вызывается при правой кнопке на сообщении — передаём id и координаты курсора. */
  onContextMenu: (id: string, x: number, y: number) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "long",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function CheckIcon({ double, className }: { double: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 18 12" className={className} fill="none" aria-hidden="true">
      <path
        d="M1 6.5 4.5 10 11 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {double && (
        <path
          d="M7 9.5 8.5 11 17 2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function MessageList({
  messages,
  selfId,
  loading,
  otherLastReadAt,
  selectedId,
  onContextMenu,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const mountTimeRef = useRef<number>(Date.now());

  // Подсветка только что отредактированных сообщений.
  const prevStateRef = useRef<Map<string, { isEdited: boolean }>>(new Map());
  const [recentlyEdited, setRecentlyEdited] = useState<Set<string>>(new Set());

  // Удалённые messages в списке не показываем вовсе.
  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.deletedAt),
    [messages]
  );

  useEffect(() => {
    const prev = prevStateRef.current;
    const justEdited = new Set<string>();
    for (const m of visibleMessages) {
      const p = prev.get(m.id);
      if (p && m.isEdited && !p.isEdited) justEdited.add(m.id);
    }
    const next = new Map<string, { isEdited: boolean }>();
    for (const m of visibleMessages) next.set(m.id, { isEdited: m.isEdited });
    prevStateRef.current = next;

    if (justEdited.size > 0) {
      setRecentlyEdited((s) => new Set([...s, ...justEdited]));
      const t = setTimeout(() => {
        setRecentlyEdited((s) => {
          const n = new Set(s);
          justEdited.forEach((id) => n.delete(id));
          return n;
        });
      }, 900);
      return () => clearTimeout(t);
    }
  }, [visibleMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [visibleMessages.length]);

  if (loading && visibleMessages.length === 0) {
    return (
      <div className="flex-1 grid place-items-center text-muted text-sm">Загружаю сообщения…</div>
    );
  }

  if (visibleMessages.length === 0) {
    return (
      <div className="flex-1 grid place-items-center text-muted text-sm">
        Пока ни одного сообщения. Напиши первым.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-3xl flex flex-col gap-1.5">
        {visibleMessages.map((m, i) => {
          const prev = visibleMessages[i - 1];
          const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const isMine = m.senderId === selfId;
          const readByOther =
            isMine &&
            !!otherLastReadAt &&
            otherLastReadAt >= m.createdAt;
          const isNew = new Date(m.createdAt).getTime() >= mountTimeRef.current;
          const animClass = isNew ? (isMine ? "msg-in-right" : "msg-in-left") : "";
          const isSelected = selectedId === m.id;
          const flashEdited = recentlyEdited.has(m.id);
          const isVoice = m.kind === "voice";
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 flex items-center justify-center">
                  <span className="bg-bg-elevated text-xs text-muted px-3 py-1 rounded-full">
                    {formatDay(m.createdAt)}
                  </span>
                </div>
              )}
              <div className={`flex relative ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu(m.id, e.clientX, e.clientY);
                  }}
                  className={`select-text max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-shadow ${animClass} ${
                    flashEdited ? "msg-flash" : ""
                  } ${
                    isMine
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-bg-panel text-white rounded-bl-md"
                  } ${isSelected ? "ring-2 ring-white/30" : ""}`}
                >
                  {m.replyTo && (
                    <div
                      className={`mb-1.5 -mx-0.5 pl-2.5 pr-2 py-1 rounded-md border-l-2 text-xs ${
                        isMine
                          ? "border-white/70 bg-white/10"
                          : "border-accent bg-accent/10"
                      }`}
                    >
                      <div className={`font-medium ${isMine ? "text-white" : "text-accent"}`}>
                        {m.replyTo.senderId === selfId ? "Вы" : "Собеседник"}
                      </div>
                      <div className="opacity-80 truncate">
                        {m.replyTo.kind === "voice"
                          ? `🎤 Голосовое (${m.replyTo.attachmentDurationSec ?? 0}c)`
                          : m.replyTo.text}
                      </div>
                    </div>
                  )}

                  {isVoice && m.attachmentUrl ? (
                    <VoiceMessage
                      src={m.attachmentUrl}
                      durationSec={m.attachmentDurationSec ?? 0}
                      isMine={isMine}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  )}

                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                      isMine ? "text-white/80" : "text-muted"
                    }`}
                  >
                    {m.isEdited && <span>edited</span>}
                    <span>{formatTime(m.createdAt)}</span>
                    {isMine && <CheckIcon double={readByOther} className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
