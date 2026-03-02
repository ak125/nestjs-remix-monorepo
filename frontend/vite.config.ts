import { resolve } from 'path';
import { vitePlugin as remix } from '@remix-run/dev';
import { flatRoutes } from 'remix-flat-routes';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const MODE = process.env.NODE_ENV;
const isProduction = MODE === 'production';
const isAnalyze = process.env.ANALYZE === 'true';
// Note: installGlobals() supprimé - Node 20+ a fetch natif, évite conflits undici

export default defineConfig({
	resolve: {
		preserveSymlinks: true,
		dedupe: ['react', 'react-dom', 'react/jsx-runtime', '@remix-run/react'],
	},
	// Proxy /img vers production pour les images Supabase en dev
	server: {
		proxy: {
			'/img': {
				target: 'https://www.automecanik.com',
				changeOrigin: true,
			},
		},
	},
	build: {
		cssMinify: MODE === 'production',
		sourcemap: false, // Désactivé pour réduire la taille du bundle
		commonjsOptions: {
			include: [/frontend/, /backend/, /node_modules/],
		},
		rollupOptions: {
			output: {
				// Vendor chunking — only pure third-party node_modules (never @remix-run/*, react-router)
				// Previous race condition was caused by splitting Remix internals; this config avoids that
				manualChunks(id) {
					if (!id.includes('node_modules')) return;

					// React core — stable, long-term cached
					if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
						return 'react-vendor';
					}
					// HTML parser stack — only loaded on content routes
					if (id.includes('/html-react-parser/') || id.includes('/dompurify/') || id.includes('/isomorphic-dompurify/') || id.includes('/htmlparser2/')) {
						return 'html-parser-vendor';
					}
					// Radix UI primitives — shared across UI components
					if (id.includes('/@radix-ui/')) {
						return 'radix-vendor';
					}
					// Embla carousel — only on routes with carousels
					if (id.includes('/embla-carousel')) {
						return 'carousel-vendor';
					}
					// cmdk — only on routes with command palette/search
					if (id.includes('/cmdk/')) {
						return 'cmdk-vendor';
					}
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
		// Bundle analyzer — run with: ANALYZE=true npm run build
		...(isAnalyze ? [visualizer({
			filename: 'bundle-report.html',
			open: false,
			gzipSize: true,
			brotliSize: true,
		})] : []),
	],
});