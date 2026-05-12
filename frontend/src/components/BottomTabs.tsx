"use client";

import Link from "next/link";

type Tab = "chats" | "profile";

interface Props {
  active: Tab;
}

const tabs: Array<{ id: Tab; label: string; href: string; icon: React.ReactNode }> = [
  {
    id: "chats",
    label: "Chats",
    href: "/chats",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Z" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.33 0-8 1.67-8 5v1h16v-1c0-3.33-4.67-5-8-5Z" />
      </svg>
    ),
  },
];

export function BottomTabs({ active }: Props) {
  return (
    <nav className="border-t border-border bg-bg-panel grid grid-cols-2">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors ${
              isActive ? "text-accent" : "text-muted hover:text-white"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
