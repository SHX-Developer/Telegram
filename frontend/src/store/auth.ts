"use client";

import { create } from "zustand";
import { api, getStoredToken, setStoredToken } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  initialized: false,

  hydrate: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const { data } = await api.get<{ user: User }>("/auth/me");
      set({ user: data.user, token, initialized: true });
    } catch {
      setStoredToken(null);
      set({ user: null, token: null, initialized: true });
    }
  },

  login: async (username, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post<AuthResponse>("/auth/login", { username, password });
      setStoredToken(data.token);
      set({ user: data.user, token: data.token });
    } finally {
      set({ loading: false });
    }
  },

  register: async (username, password, displayName) => {
    set({ loading: true });
    try {
      const { data } = await api.post<AuthResponse>("/auth/register", {
        username,
        password,
        displayName,
      });
      setStoredToken(data.token);
      set({ user: data.user, token: data.token });
    } finally {
      set({ loading: false });
    }
  },

  setUser: (user) => set({ user }),

  logout: () => {
    setStoredToken(null);
    set({ user: null, token: null });
  },
}));
