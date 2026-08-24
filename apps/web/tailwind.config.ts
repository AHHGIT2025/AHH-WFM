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
        surface: "#f8fafc",
        "surface-container": "#f1f5f9",
        "surface-container-low": "#f8fafc",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#e2e8f0",
        "surface-container-highest": "#cbd5e1",
        "on-surface": "#031751",
        "on-surface-variant": "#475569",
        "status-success": "#16A34A",
        "status-warning": "#F59E0B",
        "status-error": "#DC2626",
        "border-subtle": "#E2E8F0",
        "outline-variant": "#CBD5E1"
      },
      spacing: {
        gutter: "16px",
        "margin-desktop": "32px"
      }
    }
  },
  plugins: []
};

export default config;
