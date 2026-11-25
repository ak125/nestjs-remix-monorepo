/**
 * Fiches R4 `/reference-auto/<slug>` servies en `noindex, follow` sous le
 * drapeau `SEO_R4_NOINDEX_ENABLED` (mandat EW, décision de Marwane du
 * 25 nov. 2026 : les 62 fiches publiées sans impression Search Console sur
 * 90 jours, du 25 août au 22 nov. 2026).
 *
 * Liste fermée et figée : toute extension est une décision de Marwane. Elle est
 * disjointe des 43 fiches redirigées du mandat ER. Seule source de la liste :
 * la route backend `GET /api/seo/reference/:slug` (champ `robots`) et
 * sitemap-reference.xml la lisent ; aucune copie côté frontend, aucune colonne
 * en base.
 *
 * La page reste servie en 200 avec sa propre canonique ; ses liens restent
 * suivis. Ni redirection ni robots.txt.
 */

/** Directive robots des fiches de la liste (liens toujours suivis). */
export const R4_NOINDEX_ROBOTS = 'noindex, follow' as const;

/** Les 62 slugs, triés. */
export const R4_NOINDEX_SLUGS: readonly string[] = Object.freeze([
  'accumulateur-de-pression-de-carburant',
  'ampoule-eclairage-interieur',
  'ampoule-feu-de-recul',
  'ampoule-feu-eclaireur-de-plaque',
  'ampoule-feu-stop',
  'avertisseur-sonore',
  'bague-d-etancheite-boite-automatique',
  'bague-d-etancheite-cardan',
  'barre-de-direction',
  'biellette-de-barre-stabilisatrice',
  'bouteille-deshydratante',
  'butee-elastique-d-amortisseur',
  'cable-d-accelerateur',
  'cable-de-capot-moteur',
  'capteur-controle-de-pression-des-pneus',
  'capteur-de-pluie',
  'capteur-de-pression-turbo',
  'capteur-impulsion',
  'capteur-position-papillon',
  'capteur-pression-et-temperature-d-huile',
  'capteur-temperature-d-air-admission',
  'collecteur-d-echappement',
  'commande-correcteur-de-portee',
  'detecteur-de-l-angle-de-braquage',
  'faisceau-d-attelage',
  'feu-de-position',
  'fourchette-d-embrayage',
  'gaine-de-turbo',
  'galet-enrouleur-de-courroie-de-distribution',
  'interrupteur-position-de-marche',
  'joint-carter-de-distribution',
  'joint-d-echappement',
  'joint-d-injecteur',
  'joint-de-pompe-d-injection',
  'joint-de-turbo',
  'joint-tige-de-soupape',
  'kit-de-butee-de-suspension',
  'moteur-d-essuie-glace',
  'moyeu-de-roue',
  'neiman',
  'phares-antibrouillard',
  'pompe-a-air',
  'pompe-a-huile',
  'pompe-a-injection',
  'pompe-a-vide-de-freinage',
  'pompe-nettoyage-des-phares',
  'poulie-d-alternateur',
  'pressostat-d-huile',
  'regulateur-de-pression-carburant',
  'repartiteur-de-frein',
  'soufflet-de-cardan',
  'soufflet-de-direction',
  'soupape-d-air-secondaire',
  'soupape-de-rampe-commune-d-injection',
  'tringle-de-vitesses',
  'tringlerie-d-essuie-glace',
  'tube-d-echappement',
  'valve-de-turbo',
  'valve-magnetique',
  'vase-d-expansion',
  'verin-vitre-arriere',
  'volant-moteur',
]);

const R4_NOINDEX_SET: ReadonlySet<string> = new Set(R4_NOINDEX_SLUGS);

/**
 * Directive robots d'une fiche R4 publiée. `null` = comportement actuel
 * (`index, follow` côté page). Drapeau éteint : `null`, sans lecture de la liste.
 */
export function r4NoindexRobots(
  slug: string,
  enabled: boolean,
): typeof R4_NOINDEX_ROBOTS | null {
  if (!enabled) return null;
  return R4_NOINDEX_SET.has(slug) ? R4_NOINDEX_ROBOTS : null;
}

/** Retire de sitemap-reference.xml les fiches de la liste ; ordre conservé. */
export function excludeR4NoindexReferences<T extends { slug: string }>(
  rows: readonly T[],
): { kept: T[]; excludedCount: number } {
  const kept = rows.filter((r) => !R4_NOINDEX_SET.has(r.slug));
  return { kept, excludedCount: rows.length - kept.length };
}
