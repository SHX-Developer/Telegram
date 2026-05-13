"use client";

import { useEffect, useRef } from "react";

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

const CATEGORIES: Array<{ title: string; emojis: string[] }> = [
  {
    title: "Часто",
    emojis: ["😀", "😂", "🥰", "😎", "🤔", "👍", "❤️", "🔥", "🎉", "🙏"],
  },
  {
    title: "Смайлы",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
      "😉","😊","😇","🥰","😍","🤩","😘","😗","☺️","😚",
      "😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸",
      "🤗","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯",
      "😴","🤤","😪","😵","🤯","🤠","🥳","😏","😒","😞",
      "😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺",
      "😢","😭","😤","😠","😡","🤬","😳","🥵","🥶","🤡",
    ],
  },
  {
    title: "Жесты",
    emojis: [
      "👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉",
      "👆","🖕","👇","☝️","👋","🤚","🖐","✋","🖖","👏",
      "🙌","🤝","🙏","💪","🦾","🤳",
    ],
  },
  {
    title: "Сердца",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💘","💝"],
  },
  {
    title: "Природа",
    emojis: ["🌸","🌹","🌻","🌼","🌷","🌱","🌿","☘️","🍀","🌳","🌴","🌵","🌾","🌍","☀️","🌤","⛅️","☁️","🌧","⛈","🌩","❄️","⭐️","🌟","✨"],
  },
  {
    title: "Еда",
    emojis: ["🍎","🍌","🍇","🍓","🍑","🍒","🥭","🍍","🥝","🍅","🥑","🌽","🍆","🥕","🥦","🍞","🥐","🧀","🍗","🍖","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🍣","🍜","🍝","🍱","🍩","🍪","🍰","🎂","🍫","🍿","🍺","🍷","🍸","🍹","☕️","🍵"],
  },
  {
    title: "Объекты",
    emojis: ["⚽️","🏀","🏈","⚾️","🎾","🏐","🏓","🎮","🎲","🎯","🎨","🎵","🎶","🎤","🎧","💻","📱","⌚️","📷","🔋","💡","🔑","🔒","🛒","💰","💎","🎁","📚","✏️","📝","📎","✂️","🔧","🔨","⚙️"],
  },
];

export function EmojiPicker({ onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
      window.addEventListener("keydown", onKey, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 w-[320px] max-h-[320px] overflow-y-auto rounded-2xl glass-strong shadow-glass z-30 msg-menu-pop"
    >
      {CATEGORIES.map((cat) => (
        <div key={cat.title} className="px-3 pt-2 pb-1">
          <div className="text-[10px] uppercase tracking-wider text-muted">{cat.title}</div>
          <div className="mt-1 grid grid-cols-8 gap-0.5">
            {cat.emojis.map((e, i) => (
              <button
                key={`${cat.title}-${i}`}
                type="button"
                onClick={() => onPick(e)}
                className="h-8 w-8 grid place-items-center text-lg rounded-md hover:bg-bg-hover transition-colors"
                aria-label={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
