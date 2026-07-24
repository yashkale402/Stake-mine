/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        stake: {
          dark: '#0b1520',
          card: '#132533',
          cardHover: '#1a3242',
          accent: '#00e701',
          accentHover: '#00c201',
          text: '#9fb0c7',
          textBright: '#f4f7fb',
          gold: '#f5c542',
          danger: '#ff4d6d',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        tile: 'inset 0 -4px 0 rgba(0,0,0,0.35)',
        'tile-hover': 'inset 0 -5px 0 rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.25)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0, 231, 1, 0.35)' },
          '50%': { boxShadow: '0 0 28px rgba(0, 231, 1, 0.7)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
