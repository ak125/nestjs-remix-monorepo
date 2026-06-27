/**
 * buildR8H1Emitted — reproduction BYTE-IDENTIQUE du H1 R8 véhicule réellement émis.
 *
 * Source de vérité = le `<h1>` rendu par `HeroSection.tsx:16` (route
 * `constructeurs.$brand.$model.$type`). Aujourd'hui ce H1 est composé inline dans
 * le JSX ; on l'extrait ici en fonction pure partagée pour que (a) le frontend rende
 * ce builder et (b) le fingerprint anti-duplicate hashe LA MÊME fonction — divergence
 * structurellement impossible (plan rév.9, Track A, PR-D).
 *
 * ⚠️ NE PAS confondre avec `buildR8H1` (backend `r8-keyword-plan.constants.ts:854`,
 * format « … ch (2010-auj.) ») : c'est un **contrat de planning R8 distinct**, consommé
 * par l'enrichment pipeline, qui produit un AUTRE string et n'est PAS ce que la page émet.
 * Les deux surfaces sont volontairement différentes ; ne pas les fusionner.
 *
 * Format émis (verbatim HeroSection.tsx:16) :
 *   `${marque} ${modele} ${type} ${powerPs} ch de ${yearFrom} à ${yearTo || "aujourd'hui"}`
 *
 * Pur : aucune I/O, aucune dépendance. `yearTo` falsy (null/undefined/"") → "aujourd'hui"
 * (sémantique `||` exacte de la source).
 */

export interface R8H1EmittedInput {
  marqueName: string;
  modeleName: string;
  typeName: string;
  typePowerPs: string | number;
  typeYearFrom: string | number;
  typeYearTo?: string | number | null;
}

/** Reproduit `HeroSection.tsx:16` au byte près (visible H1 R8). */
export function buildR8H1Emitted(v: R8H1EmittedInput): string {
  // `|| "aujourd'hui"` de la source : null / undefined / "" → "aujourd'hui".
  const yearTo = v.typeYearTo ? v.typeYearTo : "aujourd'hui";
  return `${v.marqueName} ${v.modeleName} ${v.typeName} ${v.typePowerPs} ch de ${v.typeYearFrom} à ${yearTo}`;
}
