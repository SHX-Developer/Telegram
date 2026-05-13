"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { useVoiceRecorder } from "@/lib/voiceRecorder";
import { readFileForUpload } from "@/lib/file";
import { EmojiPicker } from "./EmojiPicker";
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
  onSendFile: (payload: {
    dataUrl: string;
    name: string;
    mime: string;
    size: number;
  }) => Promise<void>;
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
  onSendFile,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTypingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recorder = useVoiceRecorder();
  const isRecording = recorder.state === "recording";
  const isEncoding = recorder.state === "encoding";

  // При входе в режим редактирования — подставляем текст. Фокус ставим
  // только когда это явный edit (не при обычном входе в чат).
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

  // Фокус при выборе reply — естественно, пользователь хочет писать ответ.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo?.id]);

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

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setText((t) => t + emoji);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    // Сохраняем фокус и ставим каретку после вставленного emoji
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
    if (next.trim()) {
      emitTypingStart();
      bumpTypingTimer();
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFileError(null);
    try {
      const payload = await readFileForUpload(f);
      setSending(true);
      try {
        await onSendFile(payload);
      } finally {
        setSending(false);
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Не удалось отправить файл");
    }
  }

  // ── Голос (hold-to-talk) ────────────────────────────────────────
  const recordCancelRef = useRef(false);

  async function startHoldRecord() {
    if (disabled || sending || editing) return;
    recordCancelRef.current = false;
    await recorder.start();
  }

  async function finishHoldRecord() {
    if (recordCancelRef.current) {
      recorder.cancel();
      return;
    }
    const rec = await recorder.stopAndGet();
    if (!rec) return;
    setSending(true);
    try {
      await onSendVoice(rec.dataUrl, rec.durationSec);
    } finally {
      setSending(false);
    }
  }

  function cancelHoldRecord() {
    recordCancelRef.current = true;
    recorder.cancel();
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
                : replyTo?.kind === "file"
                ? `📎 ${replyTo.attachmentName ?? "Файл"}`
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

      {(recorder.error || fileError) && (
        <div className="px-4 py-1.5 text-xs text-red-400 bg-red-500/10 border-b border-red-500/30">
          {recorder.error || fileError}
        </div>
      )}

      <div className="px-3 py-2.5 flex items-end gap-1.5 relative">
        {/* Слева — attach (открывает file picker) */}
        <IconButton
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording || disabled || sending}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="m21 11.5-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-2.83-2.83L15 7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} />

        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 rounded-2xl bg-bg-elevated px-4 py-2.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 record-pulse" />
            <span className="text-muted">Запись</span>
            <span className="text-white font-mono tabular-nums">
              {formatTimer(recorder.elapsedSec)}
            </span>
            <span className="ml-auto text-xs text-muted">Отпустите чтобы отправить</span>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={editing ? "Изменить сообщение…" : "Написать..."}
            rows={1}
            className="flex-1 resize-none max-h-40 rounded-2xl bg-bg-elevated border border-transparent hover:border-border focus:border-accent focus:shadow-[0_0_0_3px_rgba(51,144,236,0.15)] outline-none px-4 py-2.5 text-sm placeholder:text-muted transition-[border-color,box-shadow] duration-200"
          />
        )}

        {!isRecording && !showSendButton && (
          <div className="relative">
            <IconButton
              aria-label="Emoji"
              onClick={() => setEmojiOpen((v) => !v)}
              disabled={disabled}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <circle cx="9" cy="10" r="1.2" fill="currentColor" />
                <circle cx="15" cy="10" r="1.2" fill="currentColor" />
                <path d="M9 15a3 3 0 0 0 6 0" strokeLinecap="round" />
              </svg>
            </IconButton>
            {emojiOpen && (
              <EmojiPicker
                onPick={(e) => insertEmoji(e)}
                onClose={() => setEmojiOpen(false)}
              />
            )}
          </div>
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
            onPointerDown={(e) => {
              e.preventDefault();
              void startHoldRecord();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              void finishHoldRecord();
            }}
            onPointerLeave={() => {
              if (isRecording) cancelHoldRecord();
            }}
            onPointerCancel={() => {
              if (isRecording) cancelHoldRecord();
            }}
            disabled={isEncoding || disabled}
            aria-label={isRecording ? "Recording — release to send" : "Hold to record"}
            className={`h-10 w-10 grid place-items-center rounded-full transition-all duration-200 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 scale-110"
                : "bg-accent hover:bg-accent-hover"
            } disabled:opacity-50 disabled:cursor-not-allowed select-none`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" strokeLinecap="round" />
            </svg>
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
