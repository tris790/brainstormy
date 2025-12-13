/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'storm': {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a5bafc',
          400: '#8194f8',
          500: '#636ef1',
          600: '#4f4de5',
          700: '#423dca',
          800: '#3734a3',
          900: '#323281',
          950: '#1e1c4b',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 110, 241, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(99, 110, 241, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}

