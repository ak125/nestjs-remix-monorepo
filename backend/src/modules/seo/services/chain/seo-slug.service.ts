import { Injectable } from '@nestjs/common';

/**
 * Service de génération de slugs SEO.
 *
 * Reproduit la logique legacy PHP `url_title_optimizer` :
 *   1. lowercase
 *   2. remplace accents (é→e, è→e, à→a, ç→c, etc.)
 *   3. supprime les stop-words `de / du / des / la / les / et`
 *   4. caractères non `[a-z0-9-]` → `-`
 *   5. collapse les `-` consécutifs
 *   6. strip leading/trailing `-`
 *   7. tronque à `maxLength` (défaut 80, sans couper un mot quand possible)
 *
 * Logique pure — aucune DB, aucun HTTP. Testée par golden tests sur 50+ URLs
 * legacy de référence (cf. `seo-slug.service.test.ts`).
 *
 * @see plan seo-v9 §3.2 — `SeoSlugService` (PR-2c)
 */
@Injectable()
export class SeoSlugService {
  private static readonly STOP_WORDS = new Set([
    'de',
    'du',
    'des',
    'la',
    'le',
    'les',
    'et',
    // Résidus d'élision après split de l'apostrophe : "l'huile" → ["l", "huile"]
    'l',
    'd',
  ]);

  private static readonly ACCENT_MAP: Record<string, string> = {
    à: 'a',
    á: 'a',
    â: 'a',
    ã: 'a',
    ä: 'a',
    å: 'a',
    ç: 'c',
    è: 'e',
    é: 'e',
    ê: 'e',
    ë: 'e',
    ì: 'i',
    í: 'i',
    î: 'i',
    ï: 'i',
    ñ: 'n',
    ò: 'o',
    ó: 'o',
    ô: 'o',
    õ: 'o',
    ö: 'o',
    ù: 'u',
    ú: 'u',
    û: 'u',
    ü: 'u',
    ý: 'y',
    ÿ: 'y',
    ß: 'ss',
    œ: 'oe',
    æ: 'ae',
  };

  /**
   * Slugify un libellé (titre gamme, marque, modèle, etc.) avec optimisation SEO
   * (suppression stop-words). Voir `slugifyRaw` pour conserver les stop-words.
   *
   * Note : la troncature `maxLength` est appliquée APRÈS le filtrage stop-words
   * (sinon on perdrait des mots utiles à cause de tokens "de/du/..." qui auraient
   * été comptés dans la fenêtre).
   */
  slugify(input: string, maxLength = 80): string {
    const raw = this.slugifyRaw(input, Number.MAX_SAFE_INTEGER);
    return this.applyOptimization(raw, maxLength);
  }

  /**
   * Slugify "brut" : conserve les stop-words. Utile pour produire des URLs
   * fidèles à un libellé exact (ex: titre d'article blog).
   */
  slugifyRaw(input: string, maxLength = 80): string {
    if (!input) return '';

    // Normalise les guillemets/apostrophes typographiques vers ASCII pour
    // garantir une détection cohérente des élisions (l’huile = l'huile).
    const normalized = input.toLowerCase().replace(/[‘’‚‛]/g, "'");

    const accentless = this.stripAccents(normalized);

    const slug = accentless
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return this.truncate(slug, maxLength);
  }

  /**
   * Applique l'optimisation SEO sur un slug déjà normalisé : supprime les
   * stop-words `de / du / des / la / les / et / l' / d'`.
   */
  private applyOptimization(slug: string, maxLength: number): string {
    if (!slug) return '';

    const filtered = slug
      .split('-')
      .filter((token) => token && !SeoSlugService.STOP_WORDS.has(token))
      .join('-');

    return this.truncate(filtered, maxLength);
  }

  private stripAccents(input: string): string {
    let out = '';
    for (const ch of input) {
      out += SeoSlugService.ACCENT_MAP[ch] ?? ch;
    }
    return out;
  }

  /**
   * Tronque sans couper un mot quand possible :
   *   - si la coupe tombe pile sur une frontière de mot (`slug[maxLength] === '-'`),
   *     on garde la fenêtre exacte ;
   *   - sinon on revient au dernier `-` < `maxLength` ;
   *   - sinon (un seul "mot" très long) on coupe net.
   */
  private truncate(slug: string, maxLength: number): string {
    if (slug.length <= maxLength) return slug;

    if (slug.charAt(maxLength) === '-') return slug.slice(0, maxLength);

    const head = slug.slice(0, maxLength);
    const lastDash = head.lastIndexOf('-');
    if (lastDash > 0) return head.slice(0, lastDash);
    return head;
  }
}
