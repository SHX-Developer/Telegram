"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MessageAction = "reply" | "copy" | "edit" | "delete";

interface Props {
  isMine: boolean;
  canEdit: boolean;
  /** Координаты курсора при contextmenu */
  x: number;
  y: number;
  onAction: (a: MessageAction) => void;
  onClose: () => void;
}

const iconBase = "h-4 w-4";

const ICONS: Record<MessageAction, React.ReactNode> = {
  reply: (
    <svg viewBox="0 0 24 24" className={iconBase} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 14H5l5-5m-5 5 5 5m-4-5h7a6 6 0 1 1 0 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" className={iconBase} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" className={iconBase} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" strokeLinejoin="round" />
      <path d="m14 6 4 4" />
    </svg>
  ),
  delete: (
    <svg viewBox="0 0 24 24" className={iconBase} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M9 7V4h6v3m-7 0v13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const LABELS: Record<MessageAction, string> = {
  reply: "Ответить",
  copy: "Скопировать",
  edit: "Изменить",
  delete: "Удалить",
};

export function MessageActionsMenu({ isMine, canEdit, x, y, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });
  const [mounted, setMounted] = useState(false);

  // SSR-friendly portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // После монтирования замерим размеры и зажмём в viewport
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = x;
    let top = y;
    if (left + rect.width + margin > window.innerWidth) {
      left = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (top + rect.height + margin > window.innerHeight) {
      top = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocDown);
      window.addEventListener("contextmenu", onDocDown, true);
      window.addEventListener("keydown", onKey, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("contextmenu", onDocDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;

  const actions: MessageAction[] = isMine
    ? canEdit
      ? ["reply", "copy", "edit", "delete"]
      : ["reply", "copy", "delete"]
    : ["reply", "copy", "delete"];

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-[100] min-w-[170px] rounded-xl bg-bg-elevated border border-border shadow-2xl overflow-hidden msg-menu-pop"
    >
      {actions.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => {
            onAction(a);
            onClose();
          }}
          className={`flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-bg-hover transition-colors ${
            a === "delete" ? "text-red-400" : "text-white"
          }`}
          role="menuitem"
        >
          <span className="text-muted">{ICONS[a]}</span>
          {LABELS[a]}
        </button>
      ))}
    </div>,
    document.body
  );
}
