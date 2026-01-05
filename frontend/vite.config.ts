import { resolve } from 'path';
import { vitePlugin as remix } from '@remix-run/dev';
import { installGlobals } from '@remix-run/node';
import { flatRoutes } from 'remix-flat-routes';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const MODE = process.env.NODE_ENV;
const isProduction = MODE === 'production';
installGlobals();

export default defineConfig({
	resolve: {
		preserveSymlinks: true,
	},
	build: {
		cssMinify: MODE === 'production',
		sourcemap: false, // Désactivé pour réduire la taille du bundle
		commonjsOptions: {
			include: [/frontend/, /backend/, /node_modules/],
		},
		// 🚀 Optimisation chunking pour Lighthouse
		rollupOptions: {
			output: {
				manualChunks: (id: string) => {
					// Core React - cache long-terme (React + ReactDOM MUST be in same chunk)
					if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) return 'vendor-react';
					// Remix framework
					if (id.includes('@remix-run')) return 'vendor-remix';
					// UI Components (Radix) - large mais stable
					if (id.includes('@radix-ui')) return 'vendor-radix';
					// Icons - tree-shaken
					if (id.includes('lucide-react')) return 'vendor-icons';
					// Data fetching & state
					if (id.includes('@tanstack')) return 'vendor-tanstack';
					if (id.includes('zustand')) return 'vendor-state';
					// Forms (Conform, Zod, react-hook-form)
					if (id.includes('@conform-to') || id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) return 'vendor-forms';
					// Charts (recharts) - lazy load sur dashboard
					if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'vendor-charts';
					// Rich text editor (Tiptap) - lazy load
					if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-editor';
					// Carousel
					if (id.includes('embla-carousel')) return 'vendor-carousel';
					// Utilities
					if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) return 'vendor-utils';
					// Toast
					if (id.includes('sonner')) return 'vendor-toast';
					// Autres node_modules
					if (id.includes('node_modules')) return 'vendor-common';
					return undefined;
				},
			},
		},
		chunkSizeWarningLimit: 500,
	},
	plugins: [
		// cjsInterop({
		// 	dependencies: ['remix-utils', 'is-ip', '@markdoc/markdoc'],
		// }),
		tsconfigPaths({}),
		remix({
			ignoredRouteFiles: ['**/*'],
			future: {
				v3_fetcherPersist: true,
			},

			// When running locally in development mode, we use the built in remix
			// server. This does not understand the vercel lambda module format,
			// so we default back to the standard build output.
			// ignoredRouteFiles: ['**/.*', '**/*.test.{js,jsx,ts,tsx}'],
			serverModuleFormat: 'esm',

			routes: async (defineRoutes) => {
				return flatRoutes("routes", defineRoutes, {
					ignoredRouteFiles: [
						".*",
						"**/*.css",
						"**/*.test.{js,jsx,ts,tsx}",
						"**/__*.*",
						// Exclure admin, ui-kit et design-system en production
						...(isProduction ? ["**/admin.*", "**/admin/**", "**/ui-kit.*", "**/ui-kit/**", "**/design-system.*"] : []),
						// This is for server-side utilities you want to colocate next to
						// your routes without making an additional directory.
						// If you need a route that includes "server" or "client" in the
						// filename, use the escape brackets like: my-route.[server].tsx
						// 	'**/*.server.*',
						// 	'**/*.client.*',
					],
					// Since process.cwd() is the server directory, we need to resolve the path to remix project
					appDir: resolve(__dirname, "app"),
				});
			},
		}),
	],
});