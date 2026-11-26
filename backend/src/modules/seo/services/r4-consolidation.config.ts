/**
 * Liste close de la consolidation R4 → R3 (mandat ER) : 43 pages
 * `/reference-auto/{slug}` redirigées (301) vers la page conseils de leur gamme
 * quand `SEO_R4_CONSOLIDATION_ENABLED` est allumé et que la garde est satisfaite
 * (`computeR4Redirects`, r4-consolidation-policy.service.ts).
 *
 * Source unique : lue par la route de redirection, le sitemap et la règle des
 * liens. Aucune copie frontend, aucune colonne en base. Ajouter ou retirer une
 * page = modifier cette liste par PR.
 *
 * `pgId` : gamme attendue de la page (`__seo_reference.pg_id`). Une page dont la
 * gamme en base diffère n'est pas redirigée. Relevé du 2026-11-25 : les 43 slugs
 * sont publiés, leur pg_id est celui de la liste et l'alias de leur gamme est le
 * slug lui-même.
 */
export interface R4ConsolidationTarget {
  readonly slug: string;
  readonly pgId: number;
}

export const R4_CONSOLIDATION_TARGETS: ReadonlyArray<R4ConsolidationTarget> =
  Object.freeze([
    { slug: 'agregat-de-freinage', pgId: 415 },
    { slug: 'arbre-a-came', pgId: 566 },
    { slug: 'balais-d-essuie-glace', pgId: 298 },
    { slug: 'bobine-d-allumage', pgId: 689 },
    { slug: 'bougie-de-prechauffage', pgId: 243 },
    { slug: 'butee-d-embrayage', pgId: 48 },
    { slug: 'cable-d-embrayage', pgId: 478 },
    { slug: 'cardan', pgId: 13 },
    { slug: 'compresseur-de-climatisation', pgId: 447 },
    { slug: 'condenseur-de-climatisation', pgId: 448 },
    { slug: 'contacteur-de-feu-de-recul', pgId: 807 },
    { slug: 'courroie-d-accessoire', pgId: 10 },
    { slug: 'courroie-de-distribution', pgId: 306 },
    { slug: 'cremailliere-de-direction', pgId: 286 },
    { slug: 'cylindre-de-roue', pgId: 277 },
    { slug: 'disque-de-frein', pgId: 82 },
    { slug: 'filtre-a-air', pgId: 8 },
    { slug: 'filtre-a-carburant', pgId: 9 },
    { slug: 'filtre-a-huile', pgId: 7 },
    { slug: 'filtre-d-habitacle', pgId: 424 },
    { slug: 'filtre-de-boite-auto', pgId: 416 },
    { slug: 'galet-enrouleur-de-courroie-d-accessoire', pgId: 312 },
    { slug: 'galet-tendeur-de-courroie-d-accessoire', pgId: 310 },
    { slug: 'joint-de-cache-culbuteurs', pgId: 321 },
    { slug: 'joint-de-collecteur', pgId: 40 },
    { slug: 'joint-de-culasse', pgId: 318 },
    { slug: 'kit-d-embrayage', pgId: 479 },
    { slug: 'kit-de-chaine-de-distribution', pgId: 1389 },
    { slug: 'kit-de-distribution', pgId: 307 },
    { slug: 'machoires-de-frein', pgId: 70 },
    { slug: 'maitre-cylindre-de-frein', pgId: 258 },
    { slug: 'plaquette-de-frein', pgId: 402 },
    { slug: 'pompe-a-carburant', pgId: 458 },
    { slug: 'pompe-a-eau', pgId: 1260 },
    { slug: 'pompe-de-direction-assistee', pgId: 12 },
    { slug: 'poulie-d-arbre-a-came', pgId: 1067 },
    { slug: 'radiateur-de-chauffage', pgId: 467 },
    { slug: 'radiateur-de-refroidissement', pgId: 470 },
    { slug: 'support-moteur', pgId: 247 },
    { slug: 'tambour-de-frein', pgId: 123 },
    { slug: 'temoin-d-usure', pgId: 407 },
    { slug: 'thermostat', pgId: 316 },
    { slug: 'vanne-egr', pgId: 1145 },
  ]);
