"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ChatContextAction = "pin" | "unpin" | "delete";

interface Props {
  x: number;
  y: number;
  isPinned: boolean;
  onAction: (a: ChatContextAction) => void;
  onClose: () => void;
}

const ESTIMATED_WIDTH = 200;
const ITEM_HEIGHT = 40;

export function ChatContextMenu({ x, y, isPinned, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>(() => {
    const margin = 8;
    if (typeof window === "undefined") return { left: x, top: y };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const items = 2; // pin/unpin + delete
    const h = items * ITEM_HEIGHT;
    let left = x;
    let top = y;
    if (left + ESTIMATED_WIDTH + margin > vw) left = vw - ESTIMATED_WIDTH - margin;
    if (top + h + margin > vh) top = y - h;
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    return { left, top };
  });

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + w + margin > vw) left = vw - w - margin;
    if (top + h + margin > vh) top = y - h;
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      window.addEventListener("contextmenu", onDown, true);
      window.addEventListener("keydown", onKey, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("contextmenu", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.left, top: pos.top, transformOrigin: "top left" }}
      className="fixed z-[100] min-w-[200px] rounded-xl glass-strong shadow-glass overflow-hidden msg-menu-pop"
    >
      <button
        type="button"
        onClick={() => {
          onAction(isPinned ? "unpin" : "pin");
          onClose();
        }}
        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-bg-hover transition-colors text-white"
        role="menuitem"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 2v10m0 0h6l-2 4H8l-2-4h6zm0 10v10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isPinned ? "Открепить" : "Закрепить"}
      </button>
      <button
        type="button"
        onClick={() => {
          onAction("delete");
          onClose();
        }}
        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-bg-hover transition-colors text-red-400"
        role="menuitem"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M9 7V4h6v3m-7 0v13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Удалить чат
      </button>
    </div>,
    document.body
  );
}
