/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,svelte}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1db954',
        secondary: '#1ed760',
        dark: {
          100: '#282828',
          200: '#181818',
          300: '#121212',
        }
      }
    },
  },
  plugins: [],
}
