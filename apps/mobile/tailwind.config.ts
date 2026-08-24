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
        primary: "#031751",
        "primary-container": "#093FA6",
        secondary: "#093FA6",
        "secondary-container": "#116BEE",
        workflow: "#4643F3",
        "info-cyan": "#5FAFD8",
        background: "#f8fafc",
        surface: "#ffffff",
        "surface-container": "#f1f5f9",
        "surface-container-low": "#f8fafc",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#e2e8f0",
        "surface-container-highest": "#cbd5e1",
        "on-surface": "#031751",
        "on-surface-variant": "#475569",
        "status-success": "#16A34A",
        "status-error": "#DC2626",
        "status-warning": "#F59E0B",
        "status-pending": "#116BEE",
        "outline-variant": "#CBD5E1"
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
