/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101216",
        panel: "#171b22",
        line: "#2a303b",
        mint: "#14b8a6",
        signal: "#38bdf8",
        danger: "#ef4444",
      },
      boxShadow: {
        "soft": "0 20px 60px rgba(0, 0, 0, 0.28)",
      },
    },
  },
  plugins: [],
};
