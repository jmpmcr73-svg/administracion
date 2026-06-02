import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Identidad CAIA
        ink: "#06080f",        // fondo
        panel: "#0b0f1a",      // paneles glass
        cyan: "#34e1d4",       // acento principal
        azul: "#4d9bff",
        violeta: "#9b8cff",
        ambar: "#ffb84d",
        ok: "#34e1d4",
        warn: "#ffb84d",
        crit: "#ff6b6b",
        muted: "#5b6b82",
        line: "rgba(120,160,220,0.10)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(52,225,212,0.25)",
        panel: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 40px rgba(0,0,0,0.45)",
      },
      keyframes: {
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.8)" },
        },
        coreGlow: {
          "0%,100%": { opacity: "0.85", filter: "drop-shadow(0 0 6px #34e1d4)" },
          "50%": { opacity: "1", filter: "drop-shadow(0 0 14px #34e1d4)" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
        coreGlow: "coreGlow 2.4s ease-in-out infinite",
        sweep: "sweep 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
