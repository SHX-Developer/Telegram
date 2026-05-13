import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dark-purple / liquid glass палитра
        bg: {
          DEFAULT: "#0B0714",
          panel: "#151022",
          elevated: "rgba(255, 255, 255, 0.06)",
          hover: "rgba(255, 255, 255, 0.10)",
          glass: "rgba(255, 255, 255, 0.06)",
        },
        accent: {
          DEFAULT: "#7C3AED",
          hover: "#8B4DF0",
          soft: "rgba(124, 58, 237, 0.18)",
          ring: "rgba(124, 58, 237, 0.45)",
        },
        gold: {
          DEFAULT: "#D4AF37",
          hover: "#E6C158",
        },
        muted: "#A1A1AA",
        border: "rgba(255, 255, 255, 0.10)",
        // Семантические
        success: "#22C55E",
        error: "#EF4444",
        warning: "#F59E0B",
      },
      backdropBlur: {
        glass: "16px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.45)",
        accent: "0 0 0 3px rgba(124, 58, 237, 0.25)",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
