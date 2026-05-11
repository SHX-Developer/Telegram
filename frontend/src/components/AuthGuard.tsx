"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

interface Props {
  require: "authenticated" | "guest";
  children: React.ReactNode;
}

export function AuthGuard({ require, children }: Props) {
  const router = useRouter();
  const { user, initialized, hydrate } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      void hydrate();
    }
  }, [initialized, hydrate]);

  useEffect(() => {
    if (!initialized) return;
    if (require === "authenticated" && !user) {
      router.replace("/login");
    } else if (require === "guest" && user) {
      router.replace("/");
    }
  }, [initialized, user, require, router]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
    );
  }
  if (require === "authenticated" && !user) return null;
  if (require === "guest" && user) return null;

  return <>{children}</>;
}
