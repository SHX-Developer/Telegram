"use client";

import { usePathname } from "next/navigation";
import { ChatsPanel } from "./ChatsPanel";
import { ProfilePanel } from "./ProfilePanel";
import { BottomTabs } from "./BottomTabs";

export function Sidebar() {
  const pathname = usePathname() ?? "/chats";
  const activeTab: "chats" | "profile" = pathname.startsWith("/profile") ? "profile" : "chats";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "chats" ? <ChatsPanel /> : <ProfilePanel />}
      </div>
      <BottomTabs active={activeTab} />
    </div>
  );
}
