import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Telegram-inspired dark palette
        bg: {
          DEFAULT: "#0f1620",
          panel: "#17212b",
          elevated: "#1f2c39",
          hover: "#2b3a4a",
        },
        accent: {
          DEFAULT: "#3390ec",
          hover: "#2880d6",
        },
        muted: "#6b7d8f",
        border: "#2a3a4a",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
