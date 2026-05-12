"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onClearHistory: () => void;
  onDeleteChat: () => void;
}

export function ChatHeaderMenu({ onClearHistory, onDeleteChat }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chat menu"
        className="h-9 w-9 grid place-items-center rounded-full text-muted hover:text-white hover:bg-bg-hover transition-colors"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[220px] rounded-xl bg-bg-elevated border border-border shadow-2xl overflow-hidden msg-menu-pop z-30"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onClearHistory();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-bg-hover"
            role="menuitem"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 11v6M14 11v6" strokeLinecap="round" />
            </svg>
            Очистить историю
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDeleteChat();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-bg-hover"
            role="menuitem"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
            Удалить чат
          </button>
        </div>
      )}
    </div>
  );
}
