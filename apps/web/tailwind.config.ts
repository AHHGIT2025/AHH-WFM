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
        primary: "#091426",
        "primary-container": "#1e293b",
        secondary: "#0058be",
        "secondary-container": "#2170e4",
        surface: "#f7f9fb",
        "surface-container": "#eceef0",
        "surface-container-low": "#f2f4f6",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#191c1e",
        "on-surface-variant": "#45474c",
        "status-success": "#1E8E3E",
        "status-warning": "#F9AB00",
        "status-error": "#D93025",
        "border-subtle": "#DADCE0",
        "outline-variant": "#c5c6cd"
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
