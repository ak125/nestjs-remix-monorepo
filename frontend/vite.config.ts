import { reactRouter } from "@react-router/dev/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const MODE = process.env.NODE_ENV;
const isAnalyze = process.env.ANALYZE === "true";
// Note: installGlobals() supprimé - Node 20+ a fetch natif, évite conflits undici

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react-router"],
  },
  // Proxy /img vers production pour les images Supabase en dev
  server: {
    proxy: {
      "/img": {
        target: "https://www.automecanik.com",
        changeOrigin: true,
      },
    },
  },
  build: {
    cssMinify: MODE === "production",
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
        deps.filter((dep) => !dep.includes("sentry-vendor")),
    },
    rollupOptions: {
      output: {
        // Vendor chunking — only pure third-party node_modules (never react-router)
        // Previous race condition was caused by splitting Remix internals; this config avoids that
        manualChunks(id) {
          // ─── Vendor chunks (node_modules) ────────────────────
          if (id.includes("node_modules")) {
            // Sentry SDK — loaded asynchronously post-hydration via dynamic
            // import in entry.client.tsx. Isolated chunk avoids capture by
            // later /react/ or /react-dom/ rules (e.g. transitive @sentry/react).
            if (id.includes("/@sentry/")) {
              return "sentry-vendor";
            }
            // React core — stable, long-term cached
            if (
              id.includes("/react-dom/") ||
              id.includes("/react/") ||
              id.includes("/scheduler/")
            ) {
              return "react-vendor";
            }
            // HTML parser stack — only loaded on content routes
            if (
              id.includes("/html-react-parser/") ||
              id.includes("/dompurify/") ||
              id.includes("/isomorphic-dompurify/") ||
              id.includes("/htmlparser2/")
            ) {
              return "html-parser-vendor";
            }
            // Radix UI primitives — shared across UI components
            if (id.includes("/@radix-ui/")) {
              return "radix-vendor";
            }
            // Embla carousel — only on routes with carousels
            if (id.includes("/embla-carousel")) {
              return "carousel-vendor";
            }
            // cmdk — only on routes with command palette/search
            if (id.includes("/cmdk/")) {
              return "cmdk-vendor";
            }
            // Lucide icons — deduplicate across routes
            if (id.includes("/lucide-react/")) {
              return "lucide-vendor";
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
          if (id.includes("/app/components/ui/")) return "app-ui-primitives";
          if (
            id.includes("/app/components/layout/") ||
            /\/app\/components\/(Section|SectionHeader|Footer)\.tsx$/.test(id)
          )
            return "app-shell";
          if (id.includes("/app/utils/") || id.includes("/app/lib/"))
            return "app-core";
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
    // Options framework (ssr, routes, future) déplacées vers react-router.config.ts
    // + app/routes.ts (RR7 : le plugin Vite n'accepte plus d'options). PR-9h Phase C.
    reactRouter(),
    // Bundle analyzer — run with: ANALYZE=true npm run build
    ...(isAnalyze
      ? [
          visualizer({
            filename: "bundle-report.html",
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
});
