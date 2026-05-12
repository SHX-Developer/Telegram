"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { useVoiceRecorder } from "@/lib/voiceRecorder";
import type { Message } from "@/lib/types";

interface Props {
  chatId: string;
  disabled?: boolean;
  editing?: Message | null;
  replyTo?: Message | null;
  replyToAuthorName?: string;
  onCancelEditing?: () => void;
  onCancelReply?: () => void;
  onSend: (
    text: string,
    opts: { replyToId?: string | null; editId?: string | null }
  ) => Promise<void>;
  onSendVoice: (dataUrl: string, durationSec: number) => Promise<void>;
}

const TYPING_STOP_MS = 3000;

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MessageInput({
  chatId,
  disabled,
  editing,
  replyTo,
  replyToAuthorName,
  onCancelEditing,
  onCancelReply,
  onSend,
  onSendVoice,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTypingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recorder = useVoiceRecorder();
  const isRecording = recorder.state === "recording";
  const isEncoding = recorder.state === "encoding";

  useEffect(() => {
    if (editing) {
      setText(editing.text);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      });
    } else {
      setText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo?.id]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [chatId]);

  function emitTypingStart() {
    if (isTypingRef.current || editing) return;
    isTypingRef.current = true;
    getSocket()?.emit("typing_start", { chatId });
  }
  function emitTypingStop() {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    getSocket()?.emit("typing_stop", { chatId });
  }
  function bumpTypingTimer() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(emitTypingStop, TYPING_STOP_MS);
  }

  function onChange(value: string) {
    setText(value);
    if (value.trim()) {
      emitTypingStart();
      bumpTypingTimer();
    } else {
      emitTypingStop();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    }
  }

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      emitTypingStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      emitTypingStop();
      await onSend(trimmed, {
        replyToId: replyTo?.id ?? null,
        editId: editing?.id ?? null,
      });
      setText("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape") {
      if (editing) {
        e.stopPropagation();
        onCancelEditing?.();
        setText("");
      } else if (replyTo) {
        e.stopPropagation();
        onCancelReply?.();
      }
    }
  }

  async function onMicClick() {
    if (disabled || sending || editing) return;
    if (isRecording) {
      // Стоп → отправить
      const rec = await recorder.stopAndGet();
      if (rec) {
        setSending(true);
        try {
          await onSendVoice(rec.dataUrl, rec.durationSec);
        } finally {
          setSending(false);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }
      }
    } else {
      await recorder.start();
    }
  }

  const hasText = text.trim().length > 0;
  const showSendButton = hasText || editing;

  return (
    <form onSubmit={submit} className="border-t border-border bg-bg-panel flex flex-col">
      {(editing || replyTo) && (
        <div className="px-4 pt-2.5 pb-1 flex items-start gap-2 border-b border-border/50">
          <div className="w-0.5 self-stretch bg-accent rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-accent">
              {editing
                ? "Редактирование"
                : `Ответ${replyToAuthorName ? ` — ${replyToAuthorName}` : ""}`}
            </div>
            <div className="text-xs text-muted truncate">
              {editing
                ? editing.text
                : replyTo?.kind === "voice"
                ? `🎤 Голосовое (${replyTo.attachmentDurationSec ?? 0}c)`
                : replyTo?.text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (editing) {
                onCancelEditing?.();
                setText("");
              } else onCancelReply?.();
            }}
            aria-label="Cancel"
            className="text-muted hover:text-white h-6 w-6 grid place-items-center rounded-md hover:bg-bg-hover"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {recorder.error && (
        <div className="px-4 py-1.5 text-xs text-red-400 bg-red-500/10 border-b border-red-500/30">
          {recorder.error}
        </div>
      )}

      <div className="px-3 py-2.5 flex items-end gap-1.5">
        {/* Слева — attach */}
        <IconButton
          aria-label="Attach file"
          title="Скоро"
          disabled={isRecording || disabled}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="m21 11.5-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-2.83-2.83L15 7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>

        {isRecording ? (
          // ── Записываем голосовое ─────────────────────────────────
          <div className="flex-1 flex items-center gap-3 rounded-2xl bg-bg-elevated px-4 py-2.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 record-pulse" />
            <span className="text-muted">Запись</span>
            <span className="text-white font-mono tabular-nums">
              {formatTimer(recorder.elapsedSec)}
            </span>
            <button
              type="button"
              onClick={() => recorder.cancel()}
              className="ml-auto text-xs text-muted hover:text-white"
            >
              Отмена
            </button>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={editing ? "Изменить сообщение…" : "Написать сообщение…"}
            rows={1}
            autoFocus
            className="flex-1 resize-none max-h-40 rounded-2xl bg-bg-elevated border border-transparent focus:border-accent outline-none px-4 py-2.5 text-sm placeholder:text-muted"
          />
        )}

        {/* Справа — стикер (placeholder), потом mic/send */}
        {!isRecording && !showSendButton && (
          <IconButton aria-label="Stickers" title="Скоро" disabled={disabled}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <circle cx="9" cy="10" r="1.2" fill="currentColor" />
              <circle cx="15" cy="10" r="1.2" fill="currentColor" />
              <path d="M9 15a3 3 0 0 0 6 0" strokeLinecap="round" />
            </svg>
          </IconButton>
        )}

        {showSendButton ? (
          <button
            type="submit"
            disabled={sending || !hasText}
            aria-label={editing ? "Save" : "Send"}
            className="h-10 w-10 grid place-items-center rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {editing ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="m3.4 20.5 17.6-8.5L3.4 3.5 3.4 10l12 2-12 2z" />
              </svg>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onMicClick}
            disabled={isEncoding || disabled}
            aria-label={isRecording ? "Stop recording" : "Record voice"}
            className={`h-10 w-10 grid place-items-center rounded-full transition-colors ${
              isRecording
                ? "bg-red-500 hover:bg-red-600"
                : "bg-accent hover:bg-accent-hover"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRecording ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function IconButton({
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      {...rest}
      className="h-10 w-10 shrink-0 grid place-items-center rounded-full text-muted hover:text-white hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
