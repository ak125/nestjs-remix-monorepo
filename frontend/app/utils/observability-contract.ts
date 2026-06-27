/**
 * Server-observability bridge contract — SHARED type, no runtime, no SDK.
 *
 * The SSR bundle carries NO server-side Sentry SDK (single-server-SDK invariant,
 * PROD incident #1106 / getsentry#21696). Server-side errors are forwarded to the
 * NestJS-owned Sentry client through `AppLoadContext.serverObservability`, whose
 * shape is this interface. The reporter itself is built backend-side in
 * `backend/src/remix/remix.controller.ts` (structurally mirrors this type — the
 * CJS↔ESM bundle boundary inside the single Node process).
 *
 * Type-only module → `import type` callers are erased at build, so importing it
 * from `root.tsx` (shared client+server) leaks no server code into the client bundle.
 *
 * Lives under `utils/` (colocated with its consumer `observability.server.ts`)
 * rather than `types/`: it is the contract for that bridge, and `utils/**` is the
 * governed ownership path (ADR-058 PR-G) for this surface.
 */
export type ServerCaptureContext = {
  mechanism?: { type: string; handled: boolean };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

export interface ServerObservability {
  captureException(error: unknown, context?: ServerCaptureContext): void;
}
