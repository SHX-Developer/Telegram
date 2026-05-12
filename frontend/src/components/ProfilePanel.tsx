"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Avatar } from "./Avatar";
import { useAuthStore } from "@/store/auth";
import { useChatsStore } from "@/store/chats";
import { updateMe } from "@/lib/users";
import { fileToResizedDataUrl } from "@/lib/image";

export function ProfilePanel() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const resetChats = useChatsStore((s) => s.reset);

  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.displayName]);

  if (!user) return null;

  const dirty = displayName.trim() !== user.displayName && displayName.trim().length > 0;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateMe({ displayName: displayName.trim() });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Не удалось сохранить");
      } else {
        setError("Не удалось сохранить");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingAvatar(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file, { maxSize: 256, quality: 0.85 });
      const updated = await updateMe({ avatarUrl: dataUrl });
      setUser(updated);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Не удалось загрузить аватар");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Не удалось загрузить аватар");
      }
    } finally {
      setUploadingAvatar(false);
      // сбросить инпут, чтобы можно было выбрать тот же файл повторно
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemoveAvatar() {
    setError(null);
    setUploadingAvatar(true);
    try {
      const updated = await updateMe({ avatarUrl: null });
      setUser(updated);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Не удалось удалить аватар");
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  function onLogout() {
    resetChats();
    logout();
    router.replace("/login");
  }

  return (
    <>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold">Profile</h1>
      </div>

      <div className="px-4 pb-3 flex flex-col items-center text-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadingAvatar}
          className="group relative outline-none rounded-full disabled:opacity-60"
          aria-label="Изменить аватар"
        >
          <Avatar name={user.displayName} url={user.avatarUrl} size="xl" />
          <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors grid place-items-center text-xs text-white opacity-0 group-hover:opacity-100">
            {uploadingAvatar ? "…" : "Изменить"}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickAvatar}
        />

        <div className="mt-3 text-base font-medium">{user.displayName}</div>
        <div className="text-sm text-muted">@{user.username}</div>

        {user.avatarUrl && (
          <button
            type="button"
            onClick={onRemoveAvatar}
            disabled={uploadingAvatar}
            className="mt-2 text-xs text-muted hover:text-red-400 disabled:opacity-50"
          >
            Удалить аватар
          </button>
        )}
      </div>

      <form onSubmit={onSave} className="px-4 pt-2 pb-4 border-t border-border">
        <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">
          Display name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={64}
          className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm"
        />
        {error && (
          <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {saved && <div className="mt-2 text-xs text-emerald-400">Сохранено</div>}
        <button
          type="submit"
          disabled={!dirty || saving}
          className="mt-3 w-full rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors py-2 text-sm font-medium"
        >
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
      </form>

      <div className="flex-1" />

      <div className="px-4 pb-4">
        <button
          onClick={onLogout}
          className="w-full rounded-lg bg-bg-elevated hover:bg-bg-hover transition-colors py-2 text-sm text-red-400"
        >
          Log out
        </button>
      </div>
    </>
  );
}
