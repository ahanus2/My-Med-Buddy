import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f4efe7",
        ink: "#1f2a2e",
        accent: "#146356",
        highlight: "#f2b85b",
        rose: "#d26a5c",
        slate: "#5d6c70"
      },
      boxShadow: {
        panel: "0 20px 45px rgba(31, 42, 46, 0.12)"
      },
      fontFamily: {
        sans: ["var(--font-sans)"]
      }
    }
  },
  plugins: []
};

export default config;
