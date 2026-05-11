"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { useAuthStore } from "@/store/auth";

export default function HomePage() {
  return (
    <AuthGuard require="authenticated">
      <Home />
    </AuthGuard>
  );
}

function Home() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-bg-panel px-6 py-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Messenger</div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted">
            <span className="text-white font-medium">{user.displayName}</span>{" "}
            <span>@{user.username}</span>
          </div>
          <button
            onClick={logout}
            className="rounded-md bg-bg-elevated hover:bg-bg-hover text-sm px-3 py-1.5 transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="flex-1 grid place-items-center px-6">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-accent/15 grid place-items-center text-accent text-3xl font-semibold">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-semibold mb-2">Welcome, {user.displayName}</h1>
          <p className="text-muted">
            Авторизация работает. Следующий этап — профиль, поиск пользователей и личные чаты.
          </p>
        </div>
      </section>
    </main>
  );
}
