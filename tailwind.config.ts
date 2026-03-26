import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#eff6ff",
        aurora: "#14b8a6",
        ember: "#f97316",
        night: "#020617",
      },
      boxShadow: {
        soft: "0 24px 80px rgba(15, 23, 42, 0.16)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(20,184,166,0.18), transparent 32%), radial-gradient(circle at top right, rgba(249,115,22,0.16), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.94), rgba(240,249,255,0.9))",
      },
    },
  },
  plugins: [],
};

export default config;
