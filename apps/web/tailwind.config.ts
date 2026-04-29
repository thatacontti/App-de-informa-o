import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1500px' },
    },
    extend: {
      colors: {
        // Painel V27 palette (catarina) · rosé warm
        cream: '#faf3ee',
        paper: '#fef9f5',
        beige: '#f5e1d9',
        amber: { DEFAULT: '#d4928f', soft: 'rgba(212,146,143,0.15)' },
        burnt: '#c97f7f',
        terra: '#8b4a52',
        deep: '#4a1f25',
        sage: '#6b8a5f',
        rust: '#b53a4a',
        gold: '#c98e85',
        ink: { 1: '#1a0f0a', 2: '#4a3a2f', 3: '#8a7f74' },
        // shadcn/ui semantic tokens (mapped to palette)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Fraunces', 'serif'],
        sans: ['var(--font-plex-sans)', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, #3a1820 0%, #5a2735 35%, #8b4a52 75%, #c97f7f 100%)',
        'kpi-stripe': 'linear-gradient(90deg, #d4928f, #8b4a52)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn .4s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
