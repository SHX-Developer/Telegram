"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";
import type { Chat } from "@/lib/types";

interface Props {
  chat: Chat;
  active: boolean;
  selfId: string;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

function CheckIcon({ double, className }: { double: boolean; className?: string }) {
  // Single check: ✓   Double check: ✓✓
  return (
    <svg viewBox="0 0 18 12" className={className} fill="none" aria-hidden="true">
      <path
        d="M1 6.5 4.5 10 11 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {double && (
        <path
          d="M7 9.5 8.5 11 17 2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function ChatListItem({ chat, active, selfId }: Props) {
  const other = chat.otherUser;
  const name = other?.displayName ?? "Unknown";
  const last = chat.lastMessage;
  const isLastMine = last?.senderId === selfId;
  const previewText = last
    ? last.deletedAt
      ? "Сообщение удалено"
      : last.kind === "voice"
      ? `🎤 Голосовое (${last.attachmentDurationSec ?? 0}c)`
      : last.text
    : "Чат пуст";
  const time = formatTime(last?.createdAt ?? chat.updatedAt);

  // Двойная галочка — если собеседник прочитал моё последнее сообщение.
  const readByOther =
    !!last &&
    isLastMine &&
    !!chat.otherUserLastReadAt &&
    chat.otherUserLastReadAt >= last.createdAt;

  return (
    <Link
      href={`/chats/${chat.id}`}
      className={`flex items-center gap-3 px-3 py-2.5 mx-1.5 rounded-lg transition-colors ${
        active ? "bg-accent text-white" : "hover:bg-bg-hover"
      }`}
    >
      <Avatar name={name} url={other?.avatarUrl} size="md" online={chat.otherUserIsOnline} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-white">{name}</span>
          <span className={`shrink-0 text-xs ${active ? "text-white/80" : "text-muted"}`}>
            {time}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`text-sm truncate flex-1 flex items-center gap-1 ${
              active ? "text-white/85" : "text-muted"
            }`}
          >
            {isLastMine && last && !last.deletedAt && (
              <CheckIcon
                double={readByOther}
                className={`h-3 w-3 shrink-0 ${
                  active
                    ? "text-white/80"
                    : readByOther
                    ? "text-accent"
                    : "text-muted"
                }`}
              />
            )}
            <span className="truncate">
              {isLastMine && last && !last.deletedAt && <span className="mr-1">Вы:</span>}
              {previewText}
            </span>
          </p>
          {chat.unreadCount > 0 && !active && (
            <span
              key={chat.unreadCount}
              className="badge-pop shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none"
              aria-label={`${chat.unreadCount} unread`}
            >
              {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
