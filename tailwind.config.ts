import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf9",
          100: "#d6f5f0",
          200: "#afe9e1",
          300: "#7bd7cc",
          400: "#46bfb3",
          500: "#25a397",
          600: "#087f73",
          700: "#08665e",
          800: "#08524d",
          900: "#074541",
          950: "#063c38",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
