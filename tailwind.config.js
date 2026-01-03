/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,html}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Tight"', 'sans-serif'],
      },
    },
  },
}
