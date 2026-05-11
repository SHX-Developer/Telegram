"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuthStore } from "@/store/auth";

export default function LoginPage() {
  return (
    <AuthGuard require="guest">
      <LoginForm />
    </AuthGuard>
  );
}

function LoginForm() {
  const router = useRouter();
  const { login, loading } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Login failed");
      } else {
        setError("Login failed");
      }
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-bg-panel border border-border rounded-2xl p-8 shadow-xl"
      >
        <h1 className="text-2xl font-semibold mb-1 text-center">Sign in</h1>
        <p className="text-muted text-sm text-center mb-6">Welcome back to Messenger</p>

        <label className="block text-sm text-muted mb-1.5">Username</label>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm"
          required
        />

        <label className="block text-sm text-muted mb-1.5">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm"
          required
        />

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors py-2 font-medium"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Create one
          </Link>
        </div>
      </form>
    </main>
  );
}
