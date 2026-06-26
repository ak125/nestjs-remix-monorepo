/**
 * SeoFieldGate — gate d'admission + de rendu PARTAGÉ pour tous les champs SEO.
 *
 * Deux fonctions pures que toute valeur traverse avant de devenir un champ résolu :
 *
 *  • brandAwareFit(value, renderMax) — remplace le clip aveugle `substring(0, max-1)+'…'`.
 *    Lorsque la valeur dépasse renderMax ET se termine par « | AutoMecanik », on rogne le
 *    SEGMENT CENTRAL en préservant la marque (au lieu de la couper en « AutoMeca… »).
 *    Réconcilie le plafond de validité (80c) et le plafond de rendu (60c) en UN seul MAX
 *    appliqué au point d'émission. → ferme G3 par construction (audit 2026-06-26).
 *
 *  • hasForbidden(value) — l'UNIQUE prédicat de termes interdits R1, appliqué
 *    SYMÉTRIQUEMENT à title ET description ET h1 (un seul gate, pas deux chemins).
 *    → ferme G5 (asymétrie title/desc) par construction.
 *
 * Pur (aucune DI, aucun I/O) — importé par SeoTitleEngineService (source unique des termes)
 * et testé isolément. Cf. `audit/seo-producer-chain-unified-verify-2026-06-26.md`.
 */

/** Marque émise en suffixe de title (source unique). */
export const SEO_BRAND_NAME = 'AutoMecanik';

/** Version du resolver — estampillée sur chaque ResolvedSeoField. */
export const SEO_RESOLVER_VERSION = 'seo-field-gate.r1.v1';

/**
 * Termes transactionnels interdits sur le router gamme (aucun signal tarifaire).
 * SOURCE UNIQUE : SeoTitleEngineService délègue ici (évite le tableau dupliqué).
 */
export const R1_FORBIDDEN_TERMS: readonly string[] = [
  'pas cher',
  'prix',
  'meilleur prix',
  'à partir de',
  'promo',
  'en stock',
  'acheter',
  'commander',
  'livraison rapide',
  'garantie',
  'satisfait ou remboursé',
  '€',
];

/**
 * Longueur de cœur minimale en-dessous de laquelle on préfère DROP la marque
 * plutôt que de garder un cœur insignifiant (le nom de gamme vit en tête du cœur).
 */
const MIN_CORE_LEN = 20;

export class SeoFieldGate {
  /** L'UNIQUE prédicat de termes interdits R1 — appliqué à title/desc/h1 symétriquement. */
  static hasForbidden(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    return R1_FORBIDDEN_TERMS.some((term) => lower.includes(term));
  }

  /**
   * Ajuste une valeur à renderMax en préservant la marque si présente en suffixe.
   * - value ≤ renderMax → inchangée.
   * - suffixe « | AutoMecanik » + assez de place → rogne le cœur, garde la marque.
   * - sinon → drop la marque et clip propre du cœur (jamais de marque coupée).
   */
  static brandAwareFit(value: string, renderMax: number): string {
    if (typeof value !== 'string' || value.length <= renderMax) return value;

    const suffix = ` | ${SEO_BRAND_NAME}`;
    if (value.endsWith(suffix)) {
      const core = value.slice(0, value.length - suffix.length);
      const roomForCore = renderMax - suffix.length - 1; // -1 pour l'ellipse
      if (roomForCore >= MIN_CORE_LEN) {
        // garde la marque intacte, rogne le segment central
        return core.slice(0, roomForCore).trimEnd() + '…' + suffix;
      }
      // pas assez de place pour les deux → on sacrifie la marque, cœur clippé proprement
      return SeoFieldGate.ellipsisClip(core, renderMax);
    }

    // pas de suffixe marque (ex. description) → clip ellipse simple
    return SeoFieldGate.ellipsisClip(value, renderMax);
  }

  private static ellipsisClip(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trimEnd() + '…';
  }
}
