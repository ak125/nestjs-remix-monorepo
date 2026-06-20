import { resolve } from 'path';
import { vitePlugin as remix } from '@remix-run/dev';
import { flatRoutes } from 'remix-flat-routes';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Single Fetch (v3_singleFetch) — active les types Single Fetch côté loaders/actions.
declare module '@remix-run/server-runtime' {
	interface Future {
		v3_singleFetch: true;
	}
}

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
		// Strip <link rel="modulepreload"> for sentry-vendor : the Sentry SDK
		// is dynamically imported in entry.client.tsx behind a first-interaction
		// trigger (PR #424). Vite's default behaviour preloads dynamic-import
		// chunks eagerly, which defeats the lazy contract — the browser fetches
		// sentry-vendor.js on initial page load even though initObservability()
		// hasn't fired. Filtering it out of the preload list restores the
		// intended behaviour : zero bytes for read-only sessions, ~150 KB only
		// transferred when the user actually interacts. All other dynamic
		// chunks keep their default preload (instant nav for lazy routes).
		modulePreload: {
			resolveDependencies: (_filename, deps) =>
				deps.filter((dep) => !dep.includes('sentry-vendor')),
		},
		rollupOptions: {
			output: {
				// Vendor chunking — only pure third-party node_modules (never @remix-run/*, react-router)
				// Previous race condition was caused by splitting Remix internals; this config avoids that
				manualChunks(id) {
					// ─── Vendor chunks (node_modules) ────────────────────
					if (id.includes('node_modules')) {
						// Sentry SDK — loaded asynchronously post-hydration via dynamic
						// import in entry.client.tsx. Isolated chunk avoids capture by
						// later /react/ or /react-dom/ rules (e.g. transitive @sentry/react).
						if (id.includes('/@sentry/')) {
							return 'sentry-vendor';
						}
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
						// Lucide icons — deduplicate across routes
						if (id.includes('/lucide-react/')) {
							return 'lucide-vendor';
						}
						return; // other node_modules → Rollup default
					}

					// ─── App-level shared chunks ─────────────────────────
					// Avoid Rollup's per-shared-component micro-chunks. Each
					// shared util/UI primitive used by ≥2 routes was emitted
					// as its own chunk (button, input, card, Section, Footer,
					// useRootData, logger, etc.) — 17 modulepreload tags on
					// the home alone. Consolidate into 4 stable chunks that
					// cache cross-route.
					if (id.includes('/app/components/ui/')) return 'app-ui-primitives';
					if (id.includes('/app/components/layout/') || /\/app\/components\/(Section|SectionHeader|Footer)\.tsx$/.test(id)) return 'app-shell';
					if (id.includes('/app/utils/') || id.includes('/app/lib/')) return 'app-core';
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
				// Lazy route discovery: manifest of 239 routes (~85 KB) is
				// loaded on demand per nav instead of injected fully at SSR.
				// Initial __remixManifest payload drops to ~5 KB, eliminating
				// the modulepreload cascade triggered by prefetch="intent".
				v3_lazyRouteDiscovery: true,
				// Surface AbortSignal.reason on aborted fetches. v3 default.
				v3_throwAbortReason: true,
				// Resolve relative paths inside splat ($) routes against the
				// splat boundary. Audit confirmed all 5 splat routes
				// ($.tsx, constructeurs.$, gammes.$, sitemaps.$, pieces.$)
				// use absolute Links only — flag is a no-op for current
				// code, opt-in for v3 readiness.
				v3_relativeSplatPath: true,
				// Single Fetch activé (PR-9h Phase A) : json()/defer() migrés vers
				// data() (status/headers) ou retours bruts ; entry.server passe à streamTimeout.
				v3_singleFetch: true,
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
						...(isProduction ? ["**/admin.!(video-hub)*", "**/ui-kit.*", "**/ui-kit/**", "**/design-system.*"] : []),
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