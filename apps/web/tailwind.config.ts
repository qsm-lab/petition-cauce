import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Legacy QSM (admin pages — no eliminar) ── */
        brand: {
          DEFAULT: "#10A51C",
          light:   "#2BBF39",
          dark:    "#0C7A14",
        },
        qsm: {
          green:       "#10A51C",
          orange:      "#FF5511",
          navy:        "#222F5B",
          "navy-dark": "#171F3D",
          blue:        "#3A8EBE",
          light:       "#F4F7F6",
        },
      },
      fontFamily: {
        /* ── Cauce v2 — todo el sistema ── */
        display: ["var(--font-anton)",     "sans-serif"],
        body:    ["var(--font-work-sans)", "sans-serif"],
        heading: ["var(--font-work-sans)", "sans-serif"],
        /* ── decorativo (mantener) ── */
        marker:  ["var(--font-fredoka)",          "sans-serif"],
        brush:   ["var(--font-permanent-marker)", "cursive"],
      },
      borderRadius: {
        pill: "9999px",
        card: "16px",
      },
      boxShadow: {
        petition: "0 10px 30px color-mix(in srgb, var(--bp) 9%, transparent)",
        "navy-sm": "0 4px 6px -1px rgba(34,47,91,0.15), 0 2px 4px -1px rgba(34,47,91,0.08)",
        "navy-md": "0 10px 15px -3px rgba(34,47,91,0.20), 0 4px 6px -2px rgba(34,47,91,0.10)",
      },
      animation: {
        "fade-in":     "fadeIn 0.4s ease-out",
        "slide-up":    "slideUp 0.4s ease-out",
        "pc-pulse":    "pc-pulse 1.6s ease-in-out infinite",
        "pc-float-in": "pc-float-in 0.22s ease-out",
        "pc-pop":      "pc-pop 0.4s ease both",
        "pc-spin":     "pc-spin 0.9s linear infinite",
        "pc-rise":     "pc-rise 0.25s ease both",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
