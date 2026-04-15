import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f5efe3",
        ink: "#132a24",
        tide: "#1f5c56",
        glow: "#e9b96e",
        mist: "#d8e4dd",
        panel: "#fffbf3",
        danger: "#a9432c",
        success: "#215f46"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(12, 32, 28, 0.12)"
      },
      backgroundImage: {
        "dashboard-radial":
          "radial-gradient(circle at top left, rgba(31, 92, 86, 0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(233, 185, 110, 0.2), transparent 28%)"
      }
    }
  },
  plugins: []
};

export default config;
