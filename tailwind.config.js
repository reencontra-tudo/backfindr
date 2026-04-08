/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { 300:'#5eead4', 400:'#2dd4bf', 500:'#14b8a6', 600:'#0d9488', 700:'#0f766e' },
        surface: { DEFAULT:'#0f172a', card:'#1e293b', border:'#334155', muted:'#475569' },
        accent: { orange:'#f97316', yellow:'#eab308' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeUp: { from:{ opacity:'0', transform:'translateY(16px)' }, to:{ opacity:'1', transform:'translateY(0)' } },
        fadeIn: { from:{ opacity:'0' }, to:{ opacity:'1' } },
        pulseRing: { '0%,100%':{ opacity:'1' }, '50%':{ opacity:'0.4' } },
      },
    },
  },
  plugins: [],
};
