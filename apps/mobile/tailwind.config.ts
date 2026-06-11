import type { Config } from "tailwindcss";
import preset from "../../packages/config/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#58002a",
        "primary-container": "#800040",
        secondary: "#715a40",
        "secondary-container": "#f9dbb9",
        background: "#fff8f8",
        surface: "#fff8f8",
        "surface-container": "#ffe8ec",
        "surface-container-low": "#fff0f2",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#f9e3e7",
        "surface-container-highest": "#f3dde1",
        "on-surface": "#24181b",
        "on-surface-variant": "#564147",
        "status-success": "#10B981",
        "status-error": "#EF4444",
        "status-pending": "#3B82F6",
        "outline-variant": "#ddbfc6"
      },
      spacing: {
        "grid-gutter": "1rem",
        "stack-gap": "1rem",
        "container-margin": "1rem"
      }
    }
  },
  plugins: []
};

export default config;
