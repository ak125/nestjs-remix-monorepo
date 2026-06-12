/**
 * VehicleAwareDescriptionComposer — déterministe, 0 LLM, 0 I/O.
 *
 * Compose une meta description R2 **grammaticalement complète** (avec verbe)
 * à partir de données autoritaires, au lieu du template DB dégénéré
 * `#LinkGammeCar#, #CompSwitch#` qui produisait des fragments sans verbe
 * (« Plaquette de frein PEUGEOT 207, au meilleur rapport… »).
 *
 * - Terme produit = nom de gamme AUTORITAIRE (jamais le mot-clé brut, cf.
 *   contamination __seo_keywords : « disque de frein » mappé sur pg 402 plaquette).
 * - Phrases via frames complets, tournés par (type_id + pg_id) → anti-cannibalisation
 *   (même logique que selectVariation/SEO_PRICE_VARIATIONS existants).
 * - Genre-safe : « votre {gamme} » (invariable), jamais d'article devinant le genre,
 *   jamais « les {gamme} » (problème de pluriel).
 * - Slots manquants (prix/count/véhicule) omis proprement.
 */

export interface DescriptionComposerInput {
  /** Nom de gamme autoritaire (DB pg_name), ex. "Plaquette de frein". */
  gammeName: string;
  marqueName?: string;
  modeleName?: string;
  /** Motorisation, ex. "1.4 HDI". */
  typeName?: string;
  /** Puissance en ch, ex. "68". */
  powerPs?: string;
  count?: number;
  /** Prix mini en euros. */
  minPrice?: number;
  /** Pour la rotation déterministe des frames. */
  typeId: number;
  pgId: number;
  /** Modifieur mot-clé déjà VALIDÉ (cf. pickGammeKeywordModifier), ex. "avant". */
  keywordModifier?: string | null;
}

const STOP = new Set([
  'de',
  'd',
  'a',
  'la',
  'le',
  'les',
  'du',
  'des',
  'l',
  'pour',
  'et',
  'au',
  'aux',
]);

/**
 * Modifieurs génériques sûrs (position) — invariants en genre ET en nombre, donc
 * grammaticalement corrects quel que soit le genre de la gamme (« plaquette avant »,
 * « disque avant »). On EXCLUT « droite/droit » (accord en genre inconnu) et les
 * pluriels non standards : sinon on émettrait du français faux sur certaines gammes.
 */
const SAFE_MODIFIERS = new Set(['avant', 'arriere', 'gauche']);

function stripDiacritics(s: string): string {
  // U+0300–U+036F = bloc Unicode "Combining Diacritical Marks" (échappements
  // explicites, pas de caractères combinants littéraux dans le source).
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function coreWords(s: string): string[] {
  return stripDiacritics((s ?? '').toLowerCase())
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/[\s']+/)
    .filter((w) => w && !STOP.has(w));
}

function formatEuro(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Choisit un modifieur mot-clé SÛR pour une gamme, ou null.
 * Anti-contamination : le mot-clé doit contenir TOUS les mots-cœur de la gamme,
 * et n'apporter qu'UN seul modifieur générique connu (avant/arrière/…).
 * Rejette « disque de frein » pour « Plaquette de frein » (mot-cœur absent).
 */
export function pickGammeKeywordModifier(
  gammeName: string,
  keywords: Array<{ keyword: string; volume: number }>,
): string | null {
  const core = coreWords(gammeName);
  if (core.length === 0) return null;
  const coreSet = new Set(core);

  const sorted = [...keywords].sort(
    (a, b) => (b.volume ?? 0) - (a.volume ?? 0),
  );
  for (const { keyword } of sorted) {
    const kw = coreWords(keyword);
    const kwSet = new Set(kw);
    const containsCore = core.every((w) => kwSet.has(w));
    if (!containsCore) continue; // pas la même gamme -> rejet (anti « disque » sur plaquette)
    const extras = kw.filter((w) => !coreSet.has(w));
    if (extras.length === 1 && SAFE_MODIFIERS.has(extras[0])) {
      return extras[0];
    }
    // mot-clé = terme nu (pas de modifieur) ou modifieur non sûr -> on continue/rejette
  }
  return null;
}

export function composeVehicleAwareDescription(
  input: DescriptionComposerInput,
): string {
  const gammeBase = (input.gammeName ?? '').trim();
  const g = input.keywordModifier
    ? `${gammeBase.toLowerCase()} ${input.keywordModifier}`
    : gammeBase.toLowerCase();
  const G = capitalize(g);

  const vehParts = [input.marqueName, input.modeleName, input.typeName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  const hasVehicle = vehParts.length > 0;
  let veh = vehParts.join(' ');
  if (hasVehicle && input.powerPs) veh += ` (${input.powerPs} ch)`;
  const V = hasVehicle ? veh : 'votre véhicule';
  const Vequip = hasVehicle ? `votre ${veh}` : 'votre véhicule';

  const hasPrice = typeof input.minPrice === 'number' && input.minPrice > 0;
  const priceClause = hasPrice
    ? ` dès ${formatEuro(input.minPrice as number)}`
    : '';

  const hasCount = typeof input.count === 'number' && input.count > 0;
  const countPhrase = hasCount
    ? `${input.count} références compatibles`
    : 'références compatibles';
  const countPhraseCap = hasCount
    ? `${input.count} références compatibles`
    : 'Références compatibles';

  const frames: string[] = [
    `Trouvez votre ${g} pour ${V} : ${countPhrase}${priceClause}. Livraison rapide.`,
    `Découvrez votre ${g} pour ${V}${priceClause}. ${countPhraseCap}, expédition rapide.`,
    `Commandez votre ${g} pour ${V}${priceClause}. ${countPhraseCap}, paiement sécurisé.`,
    `Comparez et commandez votre ${g} pour ${V}${priceClause}. Livraison rapide.`,
    `Équipez ${Vequip} : votre ${g} compatible${priceClause}${hasCount ? `, ${countPhrase}` : ''}. Livraison rapide.`,
  ];

  const idx =
    ((((input.typeId ?? 0) + (input.pgId ?? 0)) % frames.length) +
      frames.length) %
    frames.length;
  let out = frames[idx];

  // Nettoyage : espaces multiples + espace avant ponctuation.
  out = out
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,:?!])/g, '$1')
    .trim();
  void G; // capitalisé dispo pour de futurs frames sentence-initial
  return out;
}
