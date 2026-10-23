import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        royalBlue: {
          DEFAULT: "#172554",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#172554",
          950: "#0f172a",
        },
        goldenCream: {
          DEFAULT: "#FDFBF7",
          50: "#FFFFFF",
          100: "#FDFBF7",
          200: "#F9F6EE",
          300: "#F3EDE0",
          400: "#E7DCBF",
          500: "#D4C39B",
        },
      },
    },
  },
  plugins: [],
};

export default config;
