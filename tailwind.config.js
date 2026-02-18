/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./providers/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "var(--color-brand-50)",
          100: "var(--color-brand-100)",
          200: "var(--color-brand-200)",
          300: "var(--color-brand-300)",
          400: "var(--color-brand-400)",
          500: "var(--color-brand-500)",
          600: "var(--color-brand-600)",
          700: "var(--color-brand-700)",
          800: "var(--color-brand-800)",
          900: "var(--color-brand-900)",
          950: "var(--color-brand-950)",
        },
        dark: {
          DEFAULT: "var(--color-dark)",
          light: "var(--color-dark-light)",
          lighter: "var(--color-dark-lighter)",
        },
        score: {
          excellent: "var(--color-score-excellent)",
          good: "var(--color-score-good)",
          fair: "var(--color-score-fair)",
          poor: "var(--color-score-poor)",
        },
      },
      fontFamily: {
        sans: ["Inter", "var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "hero": ["4rem", { lineHeight: "1.1", fontWeight: "700" }],
        "hero-mobile": ["2.5rem", { lineHeight: "1.15", fontWeight: "700" }],
        "section": ["2.5rem", { lineHeight: "1.2", fontWeight: "700" }],
        "section-mobile": ["1.875rem", { lineHeight: "1.25", fontWeight: "700" }],
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "slide-down": "slideDown 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.5s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(192, 114, 116, 0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(192, 114, 116, 0.6)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-gradient": "linear-gradient(to bottom, var(--color-brand-50), transparent)",
        "hero-gradient-dark": "linear-gradient(to bottom, var(--color-dark), transparent)",
      },
      boxShadow: {
        "glow": "0 0 20px rgba(192, 114, 116, 0.3)",
        "glow-lg": "0 0 40px rgba(192, 114, 116, 0.4)",
        "card": "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)",
        "card-hover": "0 10px 30px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};
