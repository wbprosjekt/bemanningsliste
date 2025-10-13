import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,js,jsx}", "./components/**/*.{ts,tsx,js,jsx}", "./pages/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
        text: "var(--color-text)",
        bg: "var(--color-bg)",
      },
      borderRadius: {
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 0.25rem)",
        "2xl": "calc(var(--radius) + 0.5rem)",
      },
      fontFamily: {
        sans: ["Inter", ...fontFamily.sans],
        heading: ["Poppins", ...fontFamily.sans],
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,.06)",
      },
    },
  },
  plugins: [],
};