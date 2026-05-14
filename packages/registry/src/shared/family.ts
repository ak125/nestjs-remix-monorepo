import { z } from "zod";

/**
 * Canonical family classification for npm dependencies, used by
 * `dep-governance.yaml` (PR-D, Repository Contract series) to attribute
 * each npm package to a single functional bucket.
 *
 * Taxonomy rationale (V1):
 *   - Where possible, mirror the existing `domains.yaml` D1..D15 boundaries
 *     (auth ↔ D11, seo ↔ D3, rag ↔ D6, observability ↔ D10, etc.) so that
 *     cross-contract validation between dep-governance and ownership.yaml
 *     stays semantically aligned.
 *   - Add transverse families that have no domain home (`dev-tooling`,
 *     `build-tooling`, `testing`) — these are infrastructural, not
 *     domain-specific.
 *   - `other` is the explicit escape hatch for unclassifiables — every use
 *     should be a flag for V1.5 enrichment, not a permanent home.
 *
 * V1 cap: 14 values. V1.5 may add new families WITHOUT a schema-version bump
 * (Zod enums extend additively). Removing or renaming a value REQUIRES
 * schemaVersion bump + ADR.
 *
 * Anti-parallel-truth (canon §46 Loi B): every contract that classifies
 * npm deps MUST import this schema, never declare an inline enum.
 *
 * @see [[feedback_verify_shared_schemas_before_inventing_zod]]
 * @see [[repository-contract-series-canon-20260514]] §46 Loi B
 */
export const FamilyIdSchema = z.enum([
  "auth",              // bcrypt, passport, jose, jwt — D11 subset
  "payments",          // paybox SDK, systempay, stripe-equivs — D11 subset
  "seo",               // schema-org libs, sitemap generators — D3
  "rag",               // anthropic-sdk, qdrant client, openai SDK — D6
  "vehicle",           // (reserved — TecDoc-equivs if/when extracted) — D4
  "frontend-ui",       // react, @remix-run/*, @radix-ui/*, tailwindcss — D8
  "backend-platform",  // @nestjs/*, express, fastify-equivs — D14
  "db",                // @supabase/*, postgres, drizzle — D1+D14
  "validation",        // zod, ajv, joi, yup — D14 transverse
  "observability",     // @sentry/*, pino, opentelemetry — D10
  "dev-tooling",       // typescript, prettier, eslint*, husky, lint-staged
  "build-tooling",     // vite, turbo, tsx, esbuild, rollup, swc
  "testing",           // vitest, @testing-library/*, playwright, supertest
  "other",             // escape hatch — flag for V1.5 enrichment
]);

export type FamilyId = z.infer<typeof FamilyIdSchema>;
