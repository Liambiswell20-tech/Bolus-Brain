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
