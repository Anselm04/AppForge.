/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        forge: {
          bg: "#0a1224",
          surface: "#101a33",
          "surface-hover": "#152040",
          gold: "#d4af37",
          "text-primary": "#e8ecf5",
          "text-muted": "#8892a6",
          cyan: "#22b8ff",
          blue: "#1a56ff",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Sora",
          '"Noto Sans"',
          '"Noto Sans Devanagari"',
          '"Noto Sans SC"',
          '"Noto Sans JP"',
          '"Noto Sans KR"',
          '"Noto Sans Arabic"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        tile: "16px",
      },
      boxShadow: {
        glow: "0 0 40px rgba(34, 184, 255, 0.12)",
        "glow-gold": "0 0 24px rgba(212, 175, 55, 0.15)",
        "card-hover":
          "0 0 0 1px rgba(34, 184, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        "forge-gradient": "linear-gradient(135deg, #22b8ff 0%, #1a56ff 100%)",
        "forge-mesh":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(34,184,255,0.12), transparent), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(26,86,255,0.08), transparent)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },
      transitionDuration: {
        forge: "200ms",
      },
      animation: {
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "fade-up": "fade-up 0.5s ease-out forwards",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
