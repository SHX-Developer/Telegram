"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";
import type { Chat } from "@/lib/types";

interface Props {
  chat: Chat;
  active: boolean;
  selfId: string;
  onContextMenu?: (x: number, y: number) => void;
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

function ChannelBadge() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-muted" fill="currentColor" aria-hidden="true">
      <path d="M3 11l16-6v14L3 13v-2zm0 5l4 1v3a1 1 0 0 1-2 0v-1l-2-1v-2z" />
    </svg>
  );
}
function GroupBadge() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="9" cy="9" r="3" />
      <path d="M2 20a7 7 0 0 1 14 0" strokeLinecap="round" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M14 14h2a6 6 0 0 1 6 6" strokeLinecap="round" />
    </svg>
  );
}

export function ChatListItem({ chat, active, selfId, onContextMenu }: Props) {
  const isPrivate = chat.type === "private";
  const other = chat.otherUser;
  const name = isPrivate ? other?.displayName ?? "Unknown" : chat.title ?? "Untitled";
  const last = chat.lastMessage;
  const isLastMine = last?.senderId === selfId;
  const previewText = last
    ? last.deletedAt
      ? "Сообщение удалено"
      : last.kind === "voice"
      ? `🎤 Голосовое (${last.attachmentDurationSec ?? 0}c)`
      : last.kind === "file"
      ? `📎 ${last.attachmentName ?? "Файл"}`
      : last.text
    : "Чат пуст";
  const time = formatTime(last?.createdAt ?? chat.updatedAt);

  const readByOther =
    !!last &&
    isLastMine &&
    !!chat.otherUserLastReadAt &&
    chat.otherUserLastReadAt >= last.createdAt;

  return (
    <Link
      href={`/chats/${chat.id}`}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
      className={`flex items-center gap-3 px-3 py-2.5 mx-1.5 rounded-lg transition-colors ${
        active ? "bg-accent text-white" : "hover:bg-bg-hover"
      }`}
    >
      <Avatar
        name={name}
        url={isPrivate ? other?.avatarUrl : chat.avatarUrl}
        size="md"
        online={isPrivate ? chat.otherUserIsOnline : false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {chat.type === "channel" && <ChannelBadge />}
            {chat.type === "group" && <GroupBadge />}
            <span className="truncate font-medium text-white">{name}</span>
          </div>
          <span className={`shrink-0 text-xs flex items-center gap-1 ${active ? "text-white/80" : "text-muted"}`}>
            {chat.isPinned && (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M12 2v8h6l-2 4H8l-2-4h6V2zm0 12v8" />
              </svg>
            )}
            {time}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`text-sm truncate flex-1 flex items-center gap-1 ${
              active ? "text-white/85" : "text-muted"
            }`}
          >
            {isPrivate && isLastMine && last && !last.deletedAt && (
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
              {isPrivate && isLastMine && last && !last.deletedAt && (
                <span className="mr-1">Вы:</span>
              )}
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
