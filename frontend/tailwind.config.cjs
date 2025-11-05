const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    path.join(__dirname, './app/**/*.{js,jsx,ts,tsx}'),
    // Inclure packages UI
    path.join(__dirname, '../packages/ui/src/**/*.{js,jsx,ts,tsx}')
  ],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': '#ffe5e5',
  				'100': '#ffcccc',
  				'200': '#ff9999',
  				'300': '#ff6666',
  				'400': '#ff4d4d',
  				'500': '#FF3B30',
  				'600': '#e63629',
  				'700': '#cc2f24',
  				'800': '#b3291f',
  				'900': '#99221a',
  				'950': '#7f1b15',
  				DEFAULT: '#FF3B30',
  				foreground: '#000000'
  			},
  			secondary: {
  				'50': '#e6f0f7',
  				'100': '#cce1ef',
  				'200': '#99c3df',
  				'300': '#66a5cf',
  				'400': '#3387bf',
  				'500': '#0F4C81',
  				'600': '#0d4473',
  				'700': '#0b3c65',
  				'800': '#093457',
  				'900': '#072c49',
  				'950': '#05243b',
  				DEFAULT: '#0F4C81',
  				foreground: '#ffffff'
  			},
  			khmerCurry: '#ED5555',
  			persianIndigo: '#350B60',
  			vert: '#1FDC93',
  			bleu: '#031754',
  			bleuClair: '#D0EDFC',
  			lightTurquoise: '#E2F2F1',
  			extraLightTurquoise: '#F3F8F8',
  			darkIron: '#B0B0B0',
  			iron: '#EEEEEE',
  			success: {
  				DEFAULT: '#27AE60',
  				foreground: '#ffffff'
  			},
  			warning: {
  				DEFAULT: '#F39C12',
  				foreground: '#000000'
  			},
  			error: {
  				DEFAULT: '#C0392B',
  				foreground: '#ffffff'
  			},
  			info: {
  				DEFAULT: '#3498DB',
  				foreground: '#ffffff'
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
  			'0': '0',
  			'1': '0.25rem',
  			'2': '0.5rem',
  			'3': '0.75rem',
  			'4': '1rem',
  			'5': '1.25rem',
  			'6': '1.5rem',
  			'8': '2rem',
  			'10': '2.5rem',
  			'12': '3rem',
  			'16': '4rem',
  			'20': '5rem',
  			'24': '6rem',
  			'32': '8rem',
  			xs: '4px',
  			sm: '8px',
  			md: '16px',
  			lg: '24px',
  			xl: '32px',
  			'2xl': '40px',
  			'3xl': '48px',
  			'4xl': '64px',
  			'5xl': '80px',
  			'6xl': '96px'
  		},
  		fontFamily: {
  			heading: [
  				'Montserrat',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			],
  			body: [
  				'Inter',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			],
  			data: [
  				'Roboto Mono',
  				'ui-monospace',
  				'SF Mono',
  				'Consolas',
  				'monospace'
  			],
  			sans: [
  				'Inter',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			],
  			serif: [
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  			mono: [
  				'Roboto Mono',
  				'ui-monospace',
  				'SF Mono',
  				'Consolas',
  				'monospace'
  			]
  		},
  		fontSize: {
  			xs: '0.75rem',
  			sm: '0.875rem',
  			base: '1rem',
  			lg: '1.125rem',
  			xl: '1.25rem',
  			'2xl': '1.5rem',
  			'3xl': '1.875rem',
  			'4xl': '2.25rem',
  			'5xl': '3rem',
  			'6xl': '3.75rem'
  		},
  		boxShadow: {
  			none: 'none',
  			sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  			base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  			md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  			lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  			xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  			'2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  			inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)'
  		},
  		borderRadius: {
  			none: '0',
  			sm: '0.125rem',
  			base: '0.25rem',
  			md: '0.375rem',
  			lg: 'var(--radius)',
  			xl: '0.75rem',
  			'2xl': '1rem',
  			'3xl': '1.5rem',
  			full: '9999px'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
