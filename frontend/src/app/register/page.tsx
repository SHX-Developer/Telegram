"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuthStore } from "@/store/auth";

export default function RegisterPage() {
  return (
    <AuthGuard require="guest">
      <RegisterForm />
    </AuthGuard>
  );
}

function RegisterForm() {
  const router = useRouter();
  const { register, loading } = useAuthStore();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(username.trim(), password, displayName.trim());
      router.replace("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Registration failed");
      } else {
        setError("Registration failed");
      }
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-bg-panel border border-border rounded-2xl p-8 shadow-xl"
      >
        <h1 className="text-2xl font-semibold mb-1 text-center">Create account</h1>
        <p className="text-muted text-sm text-center mb-6">Sign up to start messaging</p>

        <label className="block text-sm text-muted mb-1.5">Display name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full mb-4 rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm"
          required
          maxLength={64}
        />

        <label className="block text-sm text-muted mb-1.5">Username</label>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm"
          required
          minLength={3}
          maxLength={32}
          pattern="[a-zA-Z0-9_]+"
          title="Letters, digits and underscore only"
        />

        <label className="block text-sm text-muted mb-1.5">Password</label>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm"
          required
          minLength={6}
          maxLength={128}
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
          {loading ? "Creating…" : "Create account"}
        </button>

        <div className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </div>
      </form>
    </main>
  );
}
