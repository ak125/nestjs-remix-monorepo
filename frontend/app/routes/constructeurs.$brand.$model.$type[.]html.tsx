// 🚗 Route avec extension .html pour les pages véhicules constructeurs
// Format: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
// Réexporte le contenu de la route sans .html pour éviter la duplication de code

export {
  loader,
  meta,
  shouldRevalidate,
  default,
  ErrorBoundary,
  handle, // Phase 10: Propager pageRole au root Layout
  // #798 follow-up : sans ce re-export, Remix v2 DROP le X-Robots-Tag noindex
  // throw par seoError() sur cette route .html (qui sert les vraies URLs véhicules),
  // car la route source exporte `headers` mais le wrapper ne le ré-exportait pas.
  headers,
} from "./constructeurs.$brand.$model.$type";
