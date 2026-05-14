/**
 * Type shim for `@repo/registry/runtime` subpath.
 *
 * Background:
 *   - `@repo/registry` is a hybrid-mode workspace package (ADR-058):
 *     - default subpath `.` serves TS source (consumed by tsx scripts, no build prereq)
 *     - `./runtime` subpath serves compiled `dist/` (consumed by NestJS compiled
 *       backend for value imports like `SeoCriticalitySchema`, `classifyRoute`)
 *
 *   - Backend `tsconfig.json` inherits `moduleResolution: "Node"` from the
 *     shared base. Legacy Node resolution does NOT honor `package.json#exports`
 *     subpath conditions, so `tsc` cannot find `@repo/registry/runtime` and
 *     emits TS2307.
 *
 *   - We cannot switch the backend to `moduleResolution: "bundler"` (requires
 *     `module: ES2015+`, incompatible with the existing CJS emit pipeline)
 *     nor `node16` (would require `.js` extensions on every relative import).
 *
 *   - This shim makes TypeScript resolve `@repo/registry/runtime` as if it
 *     were the same module as `@repo/registry` (which it is, type-wise — both
 *     subpaths expose `./src/index.ts` for types). At runtime, Node 16+ CJS
 *     `require()` honors the `exports` map natively and routes to `dist/`.
 *
 * This file is the canonical compile-time bridge between legacy Node TS
 * resolution and modern `exports`-aware subpath consumption.
 */
declare module '@repo/registry/runtime' {
  export * from '@repo/registry';
}
