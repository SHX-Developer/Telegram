"use client";

import { useEffect, useState } from "react";
import type { Message } from "@/lib/types";

interface Props {
  message: Message;
  isMine: boolean;
  onCancel: () => void;
  onConfirm: (forEveryone: boolean) => Promise<void>;
}

export function DeleteMessageDialog({ message, isMine, onCancel, onConfirm }: Props) {
  const [forEveryone, setForEveryone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Esc внутри модалки — закрыть
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm(forEveryone);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm dialog-fade">
      <div
        role="dialog"
        aria-modal="true"
        className="dialog-pop w-full max-w-sm mx-4 rounded-2xl bg-bg-panel border border-border shadow-2xl"
      >
        <div className="p-5">
          <h2 className="text-lg font-semibold">Удалить сообщение?</h2>
          <p className="mt-2 text-sm text-muted line-clamp-2">
            {message.deletedAt ? "Сообщение уже удалено" : message.text}
          </p>

          {isMine && !message.deletedAt && (
            <label className="mt-4 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forEveryone}
                onChange={(e) => setForEveryone(e.target.checked)}
                className="h-4 w-4 accent-accent rounded cursor-pointer"
              />
              <span className="text-sm">Удалить у собеседника тоже</span>
            </label>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-4 py-1.5 text-sm hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="rounded-lg px-4 py-1.5 text-sm bg-red-500/90 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
          >
            {busy ? "Удаляю…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}
