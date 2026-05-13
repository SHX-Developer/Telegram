import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL,
});

const TOKEN_KEY = "messenger.token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// В dev — выводим в консоль подробности любой 4xx/5xx ошибки, чтобы было
// сразу видно что отвалилось, а не «Request failed with status code 500».
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (process.env.NODE_ENV !== "production" && err?.response) {
      // eslint-disable-next-line no-console
      console.error(
        `[api ${err.config?.method?.toUpperCase() ?? "?"} ${err.config?.url}] ${err.response.status}`,
        err.response.data
      );
    }
    return Promise.reject(err);
  }
);
