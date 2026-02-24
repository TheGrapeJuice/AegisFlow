/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        grid: {
          bg: "#0f1117",
          surface: "#161b27",
          border: "#1e2840",
          text: "#e2e8f0",
          muted: "#64748b",
        },
        node: {
          normal: "#22c55e",
          warning: "#eab308",
          critical: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
