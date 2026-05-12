"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function RootPage() {
  const router = useRouter();
  const { user, initialized, hydrate } = useAuthStore();

  useEffect(() => {
    if (!initialized) void hydrate();
  }, [initialized, hydrate]);

  useEffect(() => {
    if (!initialized) return;
    router.replace(user ? "/chats" : "/login");
  }, [initialized, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
  );
}
