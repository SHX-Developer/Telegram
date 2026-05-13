"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Avatar } from "./Avatar";
import { useAuthStore } from "@/store/auth";
import { useChatsStore } from "@/store/chats";
import {
  updateMe,
  setMyUsername,
  getMySettings,
  updateMySettings,
  getBlockedUsers,
  unblockUser,
  getContacts,
  removeContact,
} from "@/lib/users";
import { fileToResizedDataUrl } from "@/lib/image";
import type { PrivacyLevel, User as UserT, UserSettings } from "@/lib/types";

export function ProfilePanel() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const resetChats = useChatsStore((s) => s.reset);

  const fileRef = useRef<HTMLInputElement>(null);

  // ───── Поля профиля ────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState("");
  const [username, setUsername] = useState("");

  // ───── Состояния ───────────────────────────────────────────────
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedFlash, setSavedFlash] = useState<"profile" | "username" | "privacy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Privacy + blocked + contacts
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [blocked, setBlocked] = useState<UserT[]>([]);
  const [contacts, setContacts] = useState<UserT[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoadingExtras(true);
    Promise.all([getMySettings(), getBlockedUsers(), getContacts()])
      .then(([s, b, c]) => {
        if (!alive) return;
        setSettings(s);
        setBlocked(b);
        setContacts(c);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoadingExtras(false);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  async function onChangePrivacy(field: keyof UserSettings, value: PrivacyLevel) {
    if (!settings) return;
    const optimistic: UserSettings = { ...settings, [field]: value };
    setSettings(optimistic);
    setSavingPrivacy(true);
    try {
      const updated = await updateMySettings({ [field]: value });
      setSettings(updated);
      setSavedFlash("privacy");
      setTimeout(() => setSavedFlash(null), 1500);
    } catch {
      // откатить
      setSettings(settings);
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function onUnblock(userId: string) {
    try {
      await unblockUser(userId);
      setBlocked((s) => s.filter((u) => u.id !== userId));
    } catch {
      // ignore
    }
  }

  async function onRemoveContact(userId: string) {
    try {
      await removeContact(userId);
      setContacts((s) => s.filter((u) => u.id !== userId));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName ?? "");
    setPhoneNumber(user.phoneNumber ?? "");
    setBio(user.bio ?? "");
    setBirthday(user.birthday ? user.birthday.slice(0, 10) : "");
    setUsername(user.username ?? "");
  }, [user?.id, user?.firstName, user?.lastName, user?.phoneNumber, user?.bio, user?.birthday, user?.username]);

  if (!user) return null;

  const profileDirty =
    firstName.trim() !== user.firstName ||
    (lastName.trim() || null) !== (user.lastName ?? null) ||
    phoneNumber.trim() !== (user.phoneNumber ?? "") ||
    (bio.trim() || null) !== (user.bio ?? null) ||
    (birthday || null) !== (user.birthday ? user.birthday.slice(0, 10) : null);

  const usernameDirty = username.trim().toLowerCase() !== (user.username ?? "").toLowerCase();

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profileDirty || !user) return;
    setSavingProfile(true);
    setError(null);
    try {
      const payload: Parameters<typeof updateMe>[0] = {};
      if (firstName.trim() !== user.firstName) payload.firstName = firstName.trim();
      if ((lastName.trim() || null) !== (user.lastName ?? null))
        payload.lastName = lastName.trim() || null;
      if (phoneNumber.trim() !== (user.phoneNumber ?? "")) payload.phoneNumber = phoneNumber.trim();
      if ((bio.trim() || null) !== (user.bio ?? null)) payload.bio = bio.trim() || null;
      if ((birthday || null) !== (user.birthday ? user.birthday.slice(0, 10) : null)) {
        payload.birthday = birthday ? new Date(birthday).toISOString() : null;
      }
      const updated = await updateMe(payload);
      setUser(updated);
      setSavedFlash("profile");
      setTimeout(() => setSavedFlash(null), 1500);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Не удалось сохранить");
      else setError("Не удалось сохранить");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSaveUsername(e: FormEvent) {
    e.preventDefault();
    if (!usernameDirty || !user) return;
    const next = username.trim().toLowerCase();
    if (next && next.length < 4) {
      setUsernameError("Минимум 4 символа");
      return;
    }
    setSavingUsername(true);
    setUsernameError(null);
    try {
      const updated = await setMyUsername(next || null);
      setUser(updated);
      setSavedFlash("username");
      setTimeout(() => setSavedFlash(null), 1500);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setUsernameError(err.response?.data?.error ?? "Не удалось сохранить");
      } else {
        setUsernameError("Не удалось сохранить");
      }
    } finally {
      setSavingUsername(false);
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
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Не удалось загрузить аватар");
      else if (err instanceof Error) setError(err.message);
      else setError("Не удалось загрузить аватар");
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemoveAvatar() {
    if (!user?.avatarUrl) return;
    setUploadingAvatar(true);
    try {
      const updated = await updateMe({ avatarUrl: null });
      setUser(updated);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Не удалось удалить аватар");
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

      <div className="overflow-y-auto flex-1">
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
          {user.username ? (
            <div className="text-sm text-muted">@{user.username}</div>
          ) : (
            <div className="text-sm text-muted italic">Username не задан</div>
          )}

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

        {/* ──── Основные поля ─────────────────────────────────── */}
        <form onSubmit={onSaveProfile} className="px-4 pt-2 pb-4 border-t border-border space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Имя</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={64}
                required
                className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Фамилия</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={64}
                className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">
              Номер телефона
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+7 999 123 45 67"
              className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Био</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={2}
              placeholder="Несколько слов о себе"
              className="w-full resize-none rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
            />
            <div className="mt-0.5 text-[10px] text-muted text-right">{bio.length}/280</div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">
              День рождения
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-3 py-2 text-sm transition-colors"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          {savedFlash === "profile" && (
            <div className="text-xs text-emerald-400">Сохранено</div>
          )}

          <button
            type="submit"
            disabled={!profileDirty || savingProfile}
            className="w-full rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors py-2 text-sm font-medium"
          >
            {savingProfile ? "Сохраняю…" : "Сохранить профиль"}
          </button>
        </form>

        {/* ──── Username ─────────────────────────────────────── */}
        <form onSubmit={onSaveUsername} className="px-4 pt-3 pb-4 border-t border-border">
          <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
              maxLength={32}
              placeholder="мин. 4 символа, латиница/цифры/_"
              className="w-full rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none pl-7 pr-3 py-2 text-sm transition-colors"
            />
          </div>
          {usernameError && (
            <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {usernameError}
            </div>
          )}
          {savedFlash === "username" && (
            <div className="mt-2 text-xs text-emerald-400">Username обновлён</div>
          )}
          {usernameDirty && (
            <button
              type="submit"
              disabled={savingUsername}
              className="mt-2 w-full rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors py-1.5 text-sm font-medium"
            >
              {savingUsername ? "Сохраняю…" : user.username ? "Изменить username" : "Задать username"}
            </button>
          )}
        </form>

        {/* ──── Privacy ─────────────────────────────────────── */}
        {settings && (
          <div className="px-4 pt-3 pb-4 border-t border-border space-y-2.5">
            <div className="text-xs uppercase tracking-wider text-muted">Приватность</div>
            <PrivacyRow
              label="Время в сети видят"
              value={settings.privacyLastSeen}
              onChange={(v) => onChangePrivacy("privacyLastSeen", v)}
              disabled={savingPrivacy}
            />
            <PrivacyRow
              label="Мой аватар видят"
              value={settings.privacyAvatar}
              onChange={(v) => onChangePrivacy("privacyAvatar", v)}
              disabled={savingPrivacy}
            />
            <PrivacyRow
              label="Моё био видят"
              value={settings.privacyBio}
              onChange={(v) => onChangePrivacy("privacyBio", v)}
              disabled={savingPrivacy}
            />
            <PrivacyRow
              label="Писать мне могут"
              value={settings.privacyMessages}
              onChange={(v) => onChangePrivacy("privacyMessages", v)}
              disabled={savingPrivacy}
            />
            {savedFlash === "privacy" && (
              <div className="text-xs text-emerald-400">Сохранено</div>
            )}
          </div>
        )}

        {/* ──── Contacts ────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-3 border-t border-border">
          <div className="text-xs uppercase tracking-wider text-muted mb-2">
            Контакты ({contacts.length})
          </div>
          {loadingExtras ? (
            <div className="text-xs text-muted">Загружаю…</div>
          ) : contacts.length === 0 ? (
            <div className="text-xs text-muted">
              Пока никого не добавил. Открой профиль и нажми «Добавить в контакты».
            </div>
          ) : (
            <div className="space-y-1">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5">
                  <Avatar name={c.displayName} url={c.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{c.displayName}</div>
                    <div className="text-xs text-muted truncate">
                      {c.username ? `@${c.username}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveContact(c.id)}
                    className="text-xs text-muted hover:text-red-400 transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ──── Blocked ─────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-3 border-t border-border">
          <div className="text-xs uppercase tracking-wider text-muted mb-2">
            Заблокированные ({blocked.length})
          </div>
          {loadingExtras ? (
            <div className="text-xs text-muted">Загружаю…</div>
          ) : blocked.length === 0 ? (
            <div className="text-xs text-muted">Никого не заблокировал.</div>
          ) : (
            <div className="space-y-1">
              {blocked.map((b) => (
                <div key={b.id} className="flex items-center gap-2.5">
                  <Avatar name={b.displayName} url={b.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{b.displayName}</div>
                    <div className="text-xs text-muted truncate">
                      {b.username ? `@${b.username}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUnblock(b.id)}
                    className="text-xs text-accent hover:underline"
                  >
                    Разблокировать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 border-t border-border pt-3">
          <button
            onClick={onLogout}
            className="w-full rounded-lg bg-bg-elevated hover:bg-bg-hover transition-colors py-2 text-sm text-red-400"
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}

function PrivacyRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: PrivacyLevel;
  onChange: (v: PrivacyLevel) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PrivacyLevel)}
        disabled={disabled}
        className="rounded-lg bg-bg-elevated border border-border focus:border-accent outline-none px-2 py-1 text-xs transition-colors disabled:opacity-50"
      >
        <option value="everyone">Все</option>
        <option value="contacts">Контакты</option>
        <option value="nobody">Никто</option>
      </select>
    </label>
  );
}
