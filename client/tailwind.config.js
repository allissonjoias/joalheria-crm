/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdf8e8',
          100: '#f9edc4',
          200: '#f3d98a',
          300: '#e8c04e',
          400: '#D4AF37',
          500: '#c49b2a',
          600: '#a67c1e',
          700: '#825d18',
          800: '#6b4b17',
          900: '#5b3f18',
        },
        charcoal: {
          50: '#f2f2f5',
          100: '#e5e5eb',
          200: '#c8c8d4',
          300: '#a4a4b5',
          400: '#7a7a91',
          500: '#5f5f76',
          600: '#4c4c5f',
          700: '#3d3d4e',
          800: '#2d2d3d',
          900: '#1a1a2e',
          950: '#0f0f1b',
        },
      },
    },
  },
  plugins: [],
};
