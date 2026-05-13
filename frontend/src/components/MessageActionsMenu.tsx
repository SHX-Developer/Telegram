"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MessageAction =
  | "react"
  | "reply"
  | "copy"
  | "forward"
  | "pin"
  | "unpin"
  | "edit"
  | "delete";

interface Props {
  isMine: boolean;
  canEdit: boolean;
  canCopy: boolean;
  canPin: boolean;
  isPinned: boolean;
  /** Координаты курсора при contextmenu */
  x: number;
  y: number;
  onAction: (a: MessageAction) => void;
  onClose: () => void;
}

const iconBase = "h-4 w-4";

const forwardIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 4l6 6-6 6M3 16a6 6 0 0 1 6-6h11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const pinIcon = (
  <svg viewBox="0 0 24 24" className={iconBase} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 2v10m0 0h6l-2 4H8l-2-4h6zm0 10v10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICONS: Record<MessageAction, React.ReactNode> = {
  react: (
    <svg viewBox="0 0 24 24" className={iconBase} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15" cy="10" r="1.2" fill="currentColor" />
      <path d="M9 15a3 3 0 0 0 6 0" strokeLinecap="round" />
    </svg>
  ),
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
  forward: forwardIcon,
  pin: pinIcon,
  unpin: pinIcon,
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
  react: "Реакция",
  reply: "Ответить",
  copy: "Скопировать",
  forward: "Переслать",
  pin: "Закрепить",
  unpin: "Открепить",
  edit: "Изменить",
  delete: "Удалить",
};

// Оценки размеров до фактического замера (используются на самом первом
// рендере, чтобы меню сразу появилось в правильном углу без «прыжка»).
const ESTIMATED_WIDTH = 190;
const ESTIMATED_ITEM_HEIGHT = 40;

interface MenuPos {
  left: number;
  top: number;
  flipH: boolean;
  flipV: boolean;
}

function computePos(
  x: number,
  y: number,
  isMine: boolean,
  width: number,
  height: number
): MenuPos {
  const margin = 8;
  // window может быть недоступен при SSR — но компонент клиентский, всё ок
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  // ── Horizontal ─────────────────────────────────────────────
  let left: number;
  let flipH: boolean;
  if (isMine) {
    flipH = true;
    left = x - width;
    if (left < margin) {
      flipH = false;
      left = x;
    }
  } else {
    flipH = false;
    left = x;
    if (left + width + margin > vw) {
      flipH = true;
      left = x - width;
    }
  }
  if (left + width + margin > vw) left = vw - width - margin;
  if (left < margin) left = margin;

  // ── Vertical ───────────────────────────────────────────────
  let top: number;
  let flipV: boolean;
  if (y + height + margin > vh) {
    flipV = true;
    top = y - height;
  } else {
    flipV = false;
    top = y;
  }
  if (top + height + margin > vh) top = vh - height - margin;
  if (top < margin) top = margin;

  return { left, top, flipH, flipV };
}

export function MessageActionsMenu({
  isMine,
  canEdit,
  canCopy,
  canPin,
  isPinned,
  x,
  y,
  onAction,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // SSR-friendly portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Прикинуть количество кнопок заранее, чтобы оценка высоты была близка к реальной.
  const estimatedItems =
    1 /* react */ +
    1 /* reply */ +
    (canCopy ? 1 : 0) +
    1 /* forward */ +
    (canPin ? 1 : 0) +
    (isMine && canEdit ? 1 : 0) +
    1; /* delete */
  const estimatedHeight = estimatedItems * ESTIMATED_ITEM_HEIGHT;

  // На первом рендере уже считаем позицию по оценочным размерам — никаких прыжков.
  const [pos, setPos] = useState<MenuPos>(() =>
    computePos(x, y, isMine, ESTIMATED_WIDTH, estimatedHeight)
  );

  // После монтирования пересчитываем по фактическим размерам.
  // offsetWidth/offsetHeight игнорируют transform: scale, которое стартует с
  // animation — поэтому замер всегда даёт «настоящий» размер.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setPos(computePos(x, y, isMine, w, h));
  }, [x, y, isMine, estimatedHeight]);

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

  const actions: MessageAction[] = [
    "react",
    "reply",
    ...(canCopy ? (["copy"] as const) : []),
    "forward",
    ...(canPin ? ([isPinned ? "unpin" : "pin"] as const) : []),
    ...(isMine && canEdit ? (["edit"] as const) : []),
    "delete",
  ];

  // Origin для transform-анимации совпадает с углом, прилегающим к точке клика
  const transformOrigin = `${pos.flipV ? "bottom" : "top"} ${pos.flipH ? "right" : "left"}`;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.left, top: pos.top, transformOrigin }}
      className="fixed z-[100] min-w-[170px] rounded-xl glass-strong shadow-glass overflow-hidden msg-menu-pop"
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
