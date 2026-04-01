/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Inter"', '-apple-system', 'sans-serif'],
        body: ['"Inter"', '-apple-system', 'sans-serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
          2: 'var(--accent-2)',
          3: 'var(--accent-3)',
        },
        neon: {
          blue: 'var(--accent)',
          purple: 'var(--accent-2)',
          pink: 'var(--accent-2)',
        },
        dark: {
          900: 'var(--bg)',
          800: 'var(--bg-elevated)',
          700: 'var(--bg-panel)',
          600: 'var(--border)',
        },
        surface: {
          DEFAULT: 'var(--bg)',
          elevated: 'var(--bg-elevated)',
          panel: 'var(--bg-panel)',
          subtle: 'var(--bg-subtle)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'soft': 'var(--shadow-soft)',
        'float': 'var(--shadow-float)',
        'lifted': 'var(--shadow-lifted)',
      },
      animation: {
        'gradient': 'gradient 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'marquee': 'marquee 36s linear infinite',
        'marquee-reverse': 'marqueeReverse 36s linear infinite',
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease forwards',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'left center' },
          '50%':       { 'background-size': '200% 200%', 'background-position': 'right center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-16px)' },
        },
        glow: {
          'from': { 'box-shadow': '0 0 12px var(--glow-primary)' },
          'to':   { 'box-shadow': '0 0 28px var(--glow-primary)' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        marqueeReverse: {
          '0%':   { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%':       { opacity: '0.7', transform: 'scale(1.08)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      letterSpacing: {
        'tight': '-0.03em',
        'tighter': '-0.04em',
      },
    },
  },
  plugins: [],
}
