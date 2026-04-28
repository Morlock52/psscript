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
        surface: {
          base:    'var(--surface-base)',
          raised:  'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
          glass:   'var(--surface-glass)',
        },
        ink: {
          primary:   'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          tertiary:  'var(--ink-tertiary)',
          muted:     'var(--ink-muted)',
          inverse:   'var(--ink-inverse)',
        },
        accent:        'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        cool:          'var(--cool)',
        warm:          'var(--warm)',
        violet:        'var(--violet)',
        signal: {
          success: 'var(--signal-success)',
          warning: 'var(--signal-warning)',
          danger:  'var(--signal-danger)',
          info:    'var(--signal-info)',
        },
        ring: {
          focus: 'var(--ring-focus)',
        },
        transparent: 'transparent',
        current:     'currentColor',
        white:       '#ffffff',
        black:       '#000000',
      },
      backgroundColor: {
        'glass-light': 'rgba(255, 255, 255, 0.8)',
        'glass-dark': 'rgba(15, 23, 42, 0.8)',
      },
      boxShadow: {
        near: 'var(--shadow-near)',
        far:  'var(--shadow-far)',
        glow: 'var(--shadow-glow)',
        none: 'none',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
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
          '0%, 100%': { boxShadow: '0 0 20px -5px color-mix(in srgb, var(--accent) 30%, transparent)' },
          '50%': { boxShadow: '0 0 30px -5px color-mix(in srgb, var(--accent) 60%, transparent)' },
        },
      },
    },
  },
  plugins: [],
}
