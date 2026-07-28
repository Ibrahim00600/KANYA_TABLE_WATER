/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e6f4ff',
          100: '#b3dbff',
          200: '#80c2ff',
          300: '#4da9ff',
          400: '#1a90ff',
          500: '#0077e6',
          600: '#005eb8',
          700: '#00458a',
          800: '#002c5c',
          900: '#00132e',
        },
        water: {
          50:  '#e8f8ff',
          100: '#c3edff',
          200: '#8fdeff',
          300: '#4dceff',
          400: '#06bdff',
          500: '#00a8e8',
          600: '#0085be',
          700: '#006490',
          800: '#004460',
          900: '#002638',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 24px 0 rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
        'modal': '0 20px 60px 0 rgba(0,0,0,0.18)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
