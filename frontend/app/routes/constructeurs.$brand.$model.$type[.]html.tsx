// Route véhicule R8 — variante canonique avec extension .html.
// Format: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
//
// Délègue toute l'implémentation à ./constructeurs.$brand.$model.$type
// (même loader, même composant — pas de duplication).
//
// INVARIANT : la liste ci-dessous doit refléter TOUS les exports Remix
// du fichier source, sinon la route .html perd la fonctionnalité associée.
// Bug historique 2026-04-22 : `links` oublié → perte de brand-colors.css
// sur la route canonique .html (vérifié avec curl | grep brand-colors).
//
// Avant d'ajouter un nouvel export au fichier source, répercuter ici :
//   grep -n "^export " frontend/app/routes/constructeurs.\$brand.\$model.\$type.tsx
// Aucun `export * from` : le compilateur Remix Vite fait du static analysis
// route-module (split server/client) et le codebase n'utilise jamais ce pattern
// sur les routes (6 précédents nominatifs vérifiés).

export {
  handle, // Phase 10: Propager pageRole au root Layout
  links, // Phase F5 (2026-04-22): brand-colors.css stylesheet
  shouldRevalidate,
  loader,
  meta,
  default,
  ErrorBoundary,
} from "./constructeurs.$brand.$model.$type";
