import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
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
    // CSS minifier GELÉ sur esbuild. Vite 8 a changé le défaut de `cssMinify: true`
    // d'esbuild (Vite 7) → Lightning CSS. On fige esbuild pour que CETTE PR reste
    // strictement attribuable (seul le bundler JS change : Rollup→Rolldown, transform/
    // minify JS→Oxc) SANS toucher l'émission CSS. Justification du gel : bugs Lightning
    // CSS upstream ouverts (backdrop-filter dé-préfixé à la minif ; certains `@scope`)
    // + surface réellement utilisée (114 `backdrop-filter` dans app/**). esbuild 0.27.x
    // (peer optionnel de Vite 8, ajouté explicitement) = exactement le minifier CSS de
    // Vite 7.3.5 → sortie CSS identique. Passage à Lightning CSS = PR séparée (V8-3),
    // après vérif backdrop-filter. (Dev : `false` = pas de minif, inchangé vs Vite 7.)
    cssMinify: MODE === "production" ? "esbuild" : false,
    // Browser-target lock = exact expansion of Vite 5's old 'modules' default
    // (ESBUILD_MODULES_TARGET, verified in node_modules/vite/dist/node/constants.js).
    // Vite 7 changed the default to 'baseline-widely-available'
    // (chrome107/edge107/firefox104/safari16) → more modern output but a narrower
    // browser baseline. We freeze the old baseline so this PR stays strictly
    // attributable: only the build tool changes, NOT browser support. Consistent
    // with the Array.prototype.at polyfill in entry.client.tsx (covers Safari < 15.4
    // and old WebViews). cssTarget intentionally left unset (it inherits target).
    // Remove in a follow-up PR after Analytics review of the real browser mix.
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
    sourcemap: false, // Désactivé pour réduire la taille du bundle
    // build.commonjsOptions retiré : Rolldown (bundler de Vite 8) a un interop CJS
    // natif → l'option @rollup/plugin-commonjs (incl. `include`) est un no-op sous Vite 8.
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
    // Tailwind v4 — plugin Vite officiel (intercepte `@import "tailwindcss"` AVANT
    // l'inlining @import natif de Vite ; remplace @tailwindcss/postcss qui entrait en
    // conflit avec postcss-import). La config legacy reste chargée via @config dans global.css.
    tailwindcss(),
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
