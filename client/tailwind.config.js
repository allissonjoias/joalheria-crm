/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cores principais WhatsAlisson
        alisson: {
          50: '#e8f5f0',
          100: '#c5e8dc',
          200: '#9dd8c5',
          300: '#6ec4a8',
          400: '#2d7a5e',
          500: '#1f5c45',
          600: '#184036', // COR PRINCIPAL - botões, sidebar
          700: '#133329',
          800: '#0e261e',
          900: '#091a14',
        },
        creme: {
          50: '#fefcf6',
          100: '#fdf8eb',
          200: '#F3EADA', // COR FUNDO PRINCIPAL
          300: '#e8d9bf',
          400: '#d9c49f',
          500: '#c5a97a',
          600: '#a88d5e',
          700: '#8a7048',
          800: '#6d5838',
          900: '#53432b',
        },
        gold: {
          50: '#fdf8e8',
          100: '#f9edc4',
          200: '#f3d98a',
          300: '#E4A978', // Coroa do leão
          400: '#D4AF37',
          500: '#c49b2a',
          600: '#a67c1e',
          700: '#825d18',
          800: '#6b4b17',
          900: '#5b3f18',
        },
        // WhatsApp-like colors
        wa: {
          green: '#184036',
          'green-light': '#dcf8c6',
          'green-msg': '#d9fdd3',
          'bubble-out': '#d9fdd3',
          'bubble-in': '#ffffff',
          'bg-chat': '#efeae2',
          'bg-panel': '#f0f2f5',
          header: '#184036',
          'header-light': '#1f5c45',
          search: '#f0f2f5',
          border: '#e9edef',
          time: '#667781',
          tick: '#53bdeb',
        },
      },
    },
  },
  plugins: [],
};
