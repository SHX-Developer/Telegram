"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "😂", "😮", "😢", "🎉", "🙏"];

interface Props {
  x: number;
  y: number;
  isMine: boolean;
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ x, y, isMine, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = isMine ? x - w : x;
    if (left + w + margin > vw) left = vw - w - margin;
    if (left < margin) left = margin;

    let top = y;
    if (top + h + margin > vh) top = y - h;
    if (top < margin) top = margin;

    setPos({ left, top });
  }, [x, y, isMine]);

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
      window.addEventListener("keydown", onKey, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      style={{ left: pos.left, top: pos.top, transformOrigin: "top left" }}
      className="fixed z-[110] flex items-center gap-1 px-2 py-1.5 rounded-full glass-strong shadow-glass msg-menu-pop"
    >
      {QUICK_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => {
            onPick(e);
            onClose();
          }}
          className="h-9 w-9 grid place-items-center text-xl rounded-full hover:bg-bg-hover hover:scale-110 transition-transform"
          aria-label={e}
        >
          {e}
        </button>
      ))}
    </div>,
    document.body
  );
}
