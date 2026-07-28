import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cell: {
          empty: "#e5e7eb",
          pending: "#f59e0b",
          verified: "#22c55e",
        },
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
