/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
      },
      colors: {
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
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'gradient': 'gradient 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          'from': {
            'text-shadow': '0 0 10px #00f0ff, 0 0 20px #00f0ff, 0 0 30px #00f0ff',
          },
          'to': {
            'text-shadow': '0 0 20px #b000ff, 0 0 30px #b000ff, 0 0 40px #b000ff',
          },
        },
      },
    },
  },
  plugins: [],
}
