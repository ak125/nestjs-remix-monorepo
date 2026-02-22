const path = require('path');
const tokens = require('../packages/design-tokens/src/tokens/design-tokens.json');

module.exports = {
  darkMode: ['class'],
  content: [
    path.join(__dirname, './app/**/*.{js,jsx,ts,tsx}'),
    path.join(__dirname, '../packages/ui/src/**/*.{js,jsx,ts,tsx}')
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          ...tokens.colors.primary,
          DEFAULT: tokens.colors.primary['500'],
          foreground: '#000000'
        },
        secondary: {
          ...tokens.colors.secondary,
          DEFAULT: tokens.colors.secondary['500'],
          foreground: '#ffffff'
        },
        khmerCurry: tokens.colors.accent.khmerCurry,
        persianIndigo: tokens.colors.accent.persianIndigo,
        vert: tokens.colors.accent.vert,
        bleu: tokens.colors.accent.bleu,
        bleuClair: tokens.colors.accent.bleuClair,
        lightTurquoise: tokens.colors.accent.lightTurquoise,
        extraLightTurquoise: tokens.colors.accent.extraLightTurquoise,
        darkIron: tokens.colors.neutral.darkIron,
        iron: tokens.colors.neutral.iron,
        neutral: tokens.colors.neutral,
        'semantic-action': tokens.colors.semantic.action,
        'semantic-action-contrast': tokens.colors.semantic.actionContrast,
        'semantic-info': tokens.colors.semantic.info,
        'semantic-info-contrast': tokens.colors.semantic.infoContrast,
        'semantic-success': tokens.colors.semantic.success,
        'semantic-success-contrast': tokens.colors.semantic.successContrast,
        'semantic-warning': tokens.colors.semantic.warning,
        'semantic-warning-contrast': tokens.colors.semantic.warningContrast,
        'semantic-danger': tokens.colors.semantic.danger,
        'semantic-danger-contrast': tokens.colors.semantic.dangerContrast,
        'semantic-neutral': tokens.colors.semantic.neutral,
        'semantic-neutral-contrast': tokens.colors.semantic.neutralContrast,
        success: {
          DEFAULT: tokens.colors.semantic.success,
          foreground: tokens.colors.semantic.successContrast
        },
        warning: {
          DEFAULT: tokens.colors.semantic.warning,
          foreground: tokens.colors.semantic.warningContrast
        },
        error: {
          DEFAULT: tokens.colors.semantic.danger,
          foreground: tokens.colors.semantic.dangerContrast
        },
        info: {
          DEFAULT: tokens.colors.semantic.info,
          foreground: tokens.colors.semantic.infoContrast
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      spacing: {
        ...tokens.spacing,
        // Fluid spacing tokens (use clamp for responsive)
        ...tokens.spacingFluid
      },
      fontFamily: {
        heading: tokens.typography.fontFamily.heading.split(', '),
        body: tokens.typography.fontFamily.body.split(', '),
        data: tokens.typography.fontFamily.data.split(', '),
        sans: tokens.typography.fontFamily.sans.split(', '),
        serif: tokens.typography.fontFamily.serif.split(', '),
        mono: tokens.typography.fontFamily.mono.split(', ')
      },
      fontSize: {
        ...tokens.typography.fontSize
      },
      boxShadow: {
        ...tokens.shadows
      },
      borderRadius: {
        ...tokens.borderRadius,
        lg: 'var(--radius)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' }
        },
        'reveal-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'reveal-up': 'reveal-up 0.6s ease both'
      },
      transitionDuration: {
        'instant': '100ms',
        'fast': '150ms',
        'normal': '250ms',
        'slow': '350ms',
        'slower': '500ms',
        'slowest': '700ms'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
