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
  const [phoneNumber, setPhoneNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register({
        phoneNumber: phoneNumber.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        password,
      });
      router.replace("/chats");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Registration failed");
      } else {
        setError("Registration failed");
      }
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6 py-8">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-bg-panel border border-border rounded-2xl p-8 shadow-xl"
      >
        <h1 className="text-2xl font-semibold mb-1 text-center">Создать аккаунт</h1>
        <p className="text-muted text-sm text-center mb-6">
          Username можно задать потом в профиле
        </p>

        <label className="block text-sm text-muted mb-1.5">Номер телефона</label>
        <input
          type="tel"
          autoComplete="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+7 999 123 45 67"
          className="w-full mb-4 rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
          required
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Имя</label>
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
              required
              maxLength={64}
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Фамилия</label>
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
              maxLength={64}
            />
          </div>
        </div>

        <label className="block text-sm text-muted mb-1.5">Пароль</label>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
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
          {loading ? "Создаю…" : "Создать аккаунт"}
        </button>

        <div className="mt-6 text-center text-sm text-muted">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Войти
          </Link>
        </div>
      </form>
    </main>
  );
}
