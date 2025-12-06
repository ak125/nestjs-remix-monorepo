// 🚗 Route avec extension .html pour les pages véhicules constructeurs
// Format: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
// Réexporte le contenu de la route sans .html pour éviter la duplication de code

export {
  loader,
  meta,
  shouldRevalidate,
  default,
  ErrorBoundary,
} from "./constructeurs.$brand.$model.$type";
