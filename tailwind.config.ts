import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#04090f",
        bg2: "#081320",
        bg3: "#0d1c30",
        teal: "#00bcd4",
        teal2: "#4dd0e1",
        ok: "#00d44c",
        amber: "#ffab00",
        red: "#ff5252",
        blue: "#448aff",
        muted: "#4a6a8a",
        ink: "#c8d8ea",
        border: "rgba(0,188,212,.12)",
        border2: "rgba(255,255,255,.05)",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "sans-serif"],
        mono: ["'Space Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
