/** @type {import('tailwindcss').Config} */
module.exports = {
  experimental: {
    colorFormat: "legacy", // Use legacy color format (rgb/hex)
  },
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "media", // or 'class' if you want manual control
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },

  plugins: [],
};
