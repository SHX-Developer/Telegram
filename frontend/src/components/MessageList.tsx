"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { VoiceMessage } from "./VoiceMessage";
import { FileBubble } from "./FileBubble";
import type { Message } from "@/lib/types";

interface Props {
  messages: Message[];
  selfId: string;
  loading: boolean;
  otherLastReadAt: string | null;
  selectedId: string | null;
  highlightId: string | null;
  /** Сейчас канал? Если да — показываем views, отмечаем view при появлении в кадре. */
  isChannel: boolean;
  onContextMenu: (id: string, x: number, y: number) => void;
  onJumpToMessage: (id: string) => void;
  /** Тап по существующей реакции — снять/сменить */
  onToggleReaction: (messageId: string, emoji: string) => void;
  /** Колбэк когда сообщение видно в чате (для каналов — отметим view) */
  onMessageVisible?: (messageId: string) => void;
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

function replyPreviewText(reply: NonNullable<Message["replyTo"]>): string {
  if (reply.deletedAt) return "Сообщение удалено";
  if (reply.kind === "voice") return `🎤 Голосовое (${reply.attachmentDurationSec ?? 0}c)`;
  if (reply.kind === "file") return `📎 ${reply.attachmentName ?? "Файл"}`;
  return reply.text;
}

export function MessageList({
  messages,
  selfId,
  loading,
  otherLastReadAt,
  selectedId,
  highlightId,
  isChannel,
  onContextMenu,
  onJumpToMessage,
  onToggleReaction,
  onMessageVisible,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const msgRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const prevStateRef = useRef<Map<string, { isEdited: boolean }>>(new Map());
  const [recentlyEdited, setRecentlyEdited] = useState<Set<string>>(new Set());

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

  // IntersectionObserver для отметки view в каналах
  const viewedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isChannel || !onMessageVisible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.messageId;
          if (!id || viewedRef.current.has(id)) continue;
          viewedRef.current.add(id);
          onMessageVisible(id);
        }
      },
      { threshold: 0.5 }
    );
    msgRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isChannel, onMessageVisible, visibleMessages.length]);

  // Когда меняется highlightId — прокручиваем к сообщению.
  useEffect(() => {
    if (!highlightId) return;
    const el = msgRefs.current.get(highlightId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId]);

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
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-3">
      <div className="flex flex-col gap-1.5">
        {visibleMessages.map((m, i) => {
          const prev = visibleMessages[i - 1];
          const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const isMine = m.senderId === selfId;
          const readByOther =
            isMine && !!otherLastReadAt && otherLastReadAt >= m.createdAt;
          const isNew = new Date(m.createdAt).getTime() >= mountTimeRef.current;
          const animClass = isNew ? (isMine ? "msg-in-right" : "msg-in-left") : "";
          const isSelected = selectedId === m.id;
          const isHighlighted = highlightId === m.id;
          const flashEdited = recentlyEdited.has(m.id);
          const isVoice = m.kind === "voice";
          const isFile = m.kind === "file";
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 flex items-center justify-center">
                  <span className="bg-bg-elevated text-xs text-muted px-3 py-1 rounded-full">
                    {formatDay(m.createdAt)}
                  </span>
                </div>
              )}
              <div className={`flex flex-col relative ${isMine ? "items-end" : "items-start"}`}>
                <div
                  ref={(el) => {
                    msgRefs.current.set(m.id, el);
                  }}
                  data-message-id={m.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu(m.id, e.clientX, e.clientY);
                  }}
                  className={`select-text max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-shadow ${animClass} ${
                    flashEdited ? "msg-flash" : ""
                  } ${
                    isHighlighted ? "msg-highlight" : ""
                  } ${
                    isMine
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-bg-panel text-white rounded-bl-md"
                  } ${isSelected ? "ring-2 ring-white/30" : ""}`}
                >
                  {m.forwardedFrom && (
                    <div
                      className={`mb-1 text-[11px] flex items-center gap-1 ${
                        isMine ? "text-white/80" : "text-accent"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 4l6 6-6 6M3 16a6 6 0 0 1 6-6h11" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>
                        Переслано от{" "}
                        <span className="font-medium">{m.forwardedFrom.displayName}</span>
                      </span>
                    </div>
                  )}

                  {m.replyTo && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (m.replyTo) onJumpToMessage(m.replyTo.id);
                      }}
                      className={`mb-1.5 w-full -mx-0.5 pl-2.5 pr-2 py-1 rounded-md border-l-2 text-xs text-left hover:opacity-90 transition-opacity ${
                        isMine
                          ? "border-white/70 bg-white/10"
                          : "border-accent bg-accent/10"
                      }`}
                    >
                      <div className={`font-medium ${isMine ? "text-white" : "text-accent"}`}>
                        {m.replyTo.senderId === selfId ? "Вы" : "Собеседник"}
                      </div>
                      <div className="opacity-80 truncate">{replyPreviewText(m.replyTo)}</div>
                    </button>
                  )}

                  {isVoice && m.attachmentUrl ? (
                    <VoiceMessage
                      src={m.attachmentUrl}
                      durationSec={m.attachmentDurationSec ?? 0}
                      isMine={isMine}
                    />
                  ) : isFile && m.attachmentUrl ? (
                    <FileBubble
                      url={m.attachmentUrl}
                      name={m.attachmentName ?? "file"}
                      mime={m.attachmentMime ?? "application/octet-stream"}
                      size={m.attachmentSize ?? 0}
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
                    {isChannel && (
                      <span className="flex items-center gap-0.5">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>{m.viewsCount}</span>
                      </span>
                    )}
                    <span>{formatTime(m.createdAt)}</span>
                    {isMine && !isChannel && <CheckIcon double={readByOther} className="h-3 w-3" />}
                  </div>
                </div>

                {m.reactions.length > 0 && (
                  <div className={`mt-1 flex flex-wrap gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
                    {m.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={() => onToggleReaction(m.id, r.emoji)}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          r.byMe
                            ? "bg-accent/25 border-accent/40 text-white"
                            : "bg-bg-elevated border-border text-muted hover:text-white"
                        }`}
                      >
                        <span className="mr-1">{r.emoji}</span>
                        <span>{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
