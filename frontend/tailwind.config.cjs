const path = require('path');
// Flat legacy projection generated from the DTCG source (src/tokens.json) by
// @fafa/design-tokens' build (Style Dictionary). Deep-equals the former raw
// design-tokens.json — Tailwind utilities compile identically. See packages/design-tokens.
const tokens = require('@fafa/design-tokens/tailwind-tokens');

module.exports = {
  darkMode: ['class'],
  content: [
    path.join(__dirname, './app/**/*.{js,jsx,ts,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          ...tokens.colors.primary,
          DEFAULT: tokens.colors.primary['500'],
          foreground: '#ffffff'
        },
        secondary: {
          ...tokens.colors.secondary,
          DEFAULT: tokens.colors.secondary['500'],
          foreground: '#ffffff'
        },

        // ─── Semantic UI Colors ───────────────────────────

        // CTA / Action orange
        cta: {
          DEFAULT: '#F97316',
          hover: '#EA580C',
          light: '#FB923C',
          lighter: '#FDBA74',
          dark: '#C2410C',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },

        // Navy / Dark backgrounds
        navy: {
          DEFAULT: '#0F1E38',
          light: '#162D5A',
          mid: '#122750',
          'mid-light': '#153060',
          dark: '#091430',
          50: '#E8EDF5',
          100: '#C5D0E6',
          200: '#9BAFD4',
          300: '#708EC1',
          400: '#4F74B3',
          500: '#162D5A',
          600: '#122750',
          700: '#0F1E38',
          800: '#091430',
          900: '#050D1F',
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
        // Échelle spacing v4 : clés NUMÉRIQUES (0,1,2,4,6,8,10,12,16,20,24) +
        // fluid (section-*/gap-*). Les clés NOMMÉES nues (xs..6xl) sont retirées :
        // en Tailwind v4 l'échelle `maxWidth` v3 a fusionné dans le namespace sizing
        // partagé, donc `spacing.{xs..6xl}` shadowait `max-w-{nommé}` (max-w-2xl=40px
        // au lieu de 672px, régression site-wide). Sans elles, `max-w-{nommé}`
        // repointe sur `--container-*` (correct), et les usages spacing nommés ont été
        // migrés vers le numérique v4 équivalent pixel-identique (md=16px=4, lg=24px=6…).
        // Tokens nommés sémantiques toujours dispo programmatiquement via @fafa/design-tokens.
        ...Object.fromEntries(
          Object.entries(tokens.spacing).filter(
            ([k]) => !['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'].includes(k)
          )
        ),
        // Fluid spacing tokens (use clamp for responsive)
        ...tokens.spacingFluid
      },
      fontFamily: {
        heading: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        data: tokens.typography.fontFamily.data.split(', '),
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: tokens.typography.fontFamily.serif.split(', '),
        mono: tokens.typography.fontFamily.mono.split(', '),
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
        'reveal-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'subtle-fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'subtle-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' }
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        'checkmark': {
          '0%': { transform: 'scale(0) rotate(-45deg)', opacity: '0' },
          '50%': { transform: 'scale(1.2) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' }
        },
        'fadeIn': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'reveal-up': 'reveal-up 0.6s ease both',
        'subtle-fade-in': 'subtle-fade-in 0.25s ease-out',
        'subtle-float': 'subtle-float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'checkmark': 'checkmark 0.3s ease-in-out',
        'fadeIn': 'fadeIn 0.3s ease-in'
      },
      transitionDuration: {
        'instant': '100ms',
        'fast': '150ms',
        'normal': '200ms',
        'slow': '250ms',
        'slower': '300ms',
        'slowest': '700ms'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
