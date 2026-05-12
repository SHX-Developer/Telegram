"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "messenger.sidebar.width";
const MIN_WIDTH = 240;
const MAX_WIDTH = 540;
const DEFAULT_WIDTH = 340;

interface Props {
  children: (width: number, drag: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode;
}

export function SidebarResizer({ children }: Props) {
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);

  // Прочитать сохранённую ширину при mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = Number(stored);
      if (Number.isFinite(n)) {
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n)));
      }
    }
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(true);
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;

    function onMouseMove(e: MouseEvent) {
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(clamped);
    }
    function onMouseUp() {
      setDragging(false);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  // Сохраняем ширину после остановки перетаскивания
  useEffect(() => {
    if (dragging) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(width));
  }, [width, dragging]);

  return (
    <>
      {children(width, {
        onMouseDown,
        role: "separator",
        "aria-orientation": "vertical" as const,
        "aria-label": "Resize sidebar",
      } as React.HTMLAttributes<HTMLDivElement>)}
    </>
  );
}

export { MIN_WIDTH as SIDEBAR_MIN_WIDTH, MAX_WIDTH as SIDEBAR_MAX_WIDTH };
