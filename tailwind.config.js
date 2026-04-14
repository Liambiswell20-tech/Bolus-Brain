/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "bb-background": "#050706",
        "bb-surface": "#1A1A1C",
        "bb-surface-raised": "#2C2C2E",
        "bb-text": "#FFFFFF",
        "bb-text-secondary": "#8E8E93",
        "bb-text-muted": "#636366",
        "bb-green": "#30D158",
        "bb-amber": "#FF9500",
        "bb-red": "#FF3B30",
        "bb-blue": "#0A84FF",
        "bb-separator": "#2C2C2E",
      },
      fontFamily: {
        "outfit": ["Outfit_400Regular"],
        "outfit-semibold": ["Outfit_600SemiBold"],
        "jetbrains": ["JetBrainsMono_400Regular"],
      },
    },
  },
  plugins: [],
};
