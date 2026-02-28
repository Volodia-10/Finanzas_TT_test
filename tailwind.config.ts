import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Chivo", "Trebuchet MS", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"]
      },
      colors: {
        canvas: "hsl(var(--canvas))",
        ink: "hsl(var(--ink))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        accentStrong: "hsl(var(--accent-strong))",
        line: "hsl(var(--line))",
        card: "hsl(var(--card))",
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))"
      },
      boxShadow: {
        soft: "0 12px 32px rgba(15, 23, 42, 0.08)"
      },
      backgroundImage: {
        "mesh-grid": "radial-gradient(circle at 20% 20%, rgba(251,146,60,0.09), transparent 48%), radial-gradient(circle at 80% 0%, rgba(20,184,166,0.12), transparent 42%), linear-gradient(135deg, rgba(2,6,23,0.02) 0%, rgba(2,6,23,0) 38%)"
      }
    }
  },
  plugins: []
};

export default config;
