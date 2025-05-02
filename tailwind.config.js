/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"], // ✅ include all HTML & JS files
  theme: {
    extend: {
      colors: {
        primary: '#6366f1', // Indigo-500
        secondary: '#10B981', // Emerald-500
        accent: '#F59E0B', // Amber-500
        dark: '#1F2937', // Gray-800
        light: '#F9FAFB', // Gray-50
      },
    },
  },
  plugins: [],
}