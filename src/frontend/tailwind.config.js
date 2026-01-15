/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Accent colors
        accent: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        // Surface colors for cards, backgrounds
        surface: {
          light: {
            DEFAULT: '#ffffff',
            secondary: '#f8fafc',
            tertiary: '#f1f5f9',
            elevated: '#ffffff',
          },
          dark: {
            DEFAULT: '#0f172a',
            secondary: '#1e293b',
            tertiary: '#334155',
            elevated: '#1e293b',
          },
        },
        // Text colors
        content: {
          light: {
            primary: '#0f172a',
            secondary: '#475569',
            tertiary: '#94a3b8',
            muted: '#cbd5e1',
          },
          dark: {
            primary: '#f8fafc',
            secondary: '#cbd5e1',
            tertiary: '#94a3b8',
            muted: '#64748b',
          },
        },
        // Border colors
        border: {
          light: {
            DEFAULT: '#e2e8f0',
            subtle: '#f1f5f9',
            strong: '#cbd5e1',
          },
          dark: {
            DEFAULT: '#334155',
            subtle: '#1e293b',
            strong: '#475569',
          },
        },
      },
      backgroundColor: {
        'glass-light': 'rgba(255, 255, 255, 0.8)',
        'glass-dark': 'rgba(15, 23, 42, 0.8)',
      },
      boxShadow: {
        'soft-sm': '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
        'soft': '0 4px 16px -4px rgba(0, 0, 0, 0.1)',
        'soft-lg': '0 8px 32px -8px rgba(0, 0, 0, 0.12)',
        'soft-xl': '0 16px 48px -12px rgba(0, 0, 0, 0.15)',
        'glow-primary': '0 0 20px -5px rgba(59, 130, 246, 0.5)',
        'glow-accent': '0 0 20px -5px rgba(217, 70, 239, 0.5)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
        // Dark mode shadows
        'dark-soft-sm': '0 2px 8px -2px rgba(0, 0, 0, 0.3)',
        'dark-soft': '0 4px 16px -4px rgba(0, 0, 0, 0.4)',
        'dark-soft-lg': '0 8px 32px -8px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px -5px rgba(59, 130, 246, 0.3)' },
          '50%': { boxShadow: '0 0 30px -5px rgba(59, 130, 246, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
