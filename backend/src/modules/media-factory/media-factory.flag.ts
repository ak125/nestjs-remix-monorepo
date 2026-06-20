/**
 * media-factory.flag — Single source of truth for the MediaFactory revival flag.
 *
 * Governed feature flag (mirror of `supplier-sync.flag.ts`): strict `=== 'true'`, **OFF by default**.
 * While OFF, the MediaFactory HTTP module and its BullMQ video-execution processor are NOT registered
 * in the DI graph → the revived module is **inert (0 prod)** until explicitly enabled.
 *
 * Revival 2026-06-20: module recovered from commit 7468868f2^ (deleted for a transitive axios CVE in
 * the TTS deps — not a house dependency). TTS now uses Azure Speech REST via native `fetch` (zero axios),
 * script-generation sources GOVERNED content (`__seo_*`), never RAG. Enable only after security CI green
 * + owner GO; never tag PROD without explicit owner approval.
 */
export function isMediaFactoryEnabled(): boolean {
  return process.env.MEDIA_FACTORY_ENABLED === 'true';
}
