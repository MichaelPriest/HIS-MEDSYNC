import type { Config } from "tailwindcss";
export default { darkMode: "class", content: ["./src/**/*.{ts,tsx}"], theme: { extend: { colors: { brand: { 50: "#eefbf9", 600: "#087f73", 700: "#08665e", 950: "#063c38" } } } }, plugins: [] } satisfies Config;
