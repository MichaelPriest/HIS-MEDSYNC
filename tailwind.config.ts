import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#173273",
          950: "#0b1f44",
        },
      },
      boxShadow: {
        "his-card": "0 10px 30px rgba(15, 31, 68, 0.06)",
        "his-float": "0 18px 45px rgba(15, 31, 68, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
