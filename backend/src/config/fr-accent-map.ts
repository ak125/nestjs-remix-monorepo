/**
 * FR Accent Map — Pure function, zero NestJS dependency.
 *
 * Shared by:
 *  - BlogSeoService.sanitizeConseilContent() (read-time quality gate)
 *  - EnricherTextUtils.restoreAccents()      (write-time enrichment)
 *
 * Band-aid fix until LLM outputs are generated with proper French accents.
 */

const ACCENT_MAP: Array<[RegExp, string]> = [
  // --- existing (from enricher-text-utils.service.ts) ---
  [/\bequipements?\b/gi, 'équipement'],
  [/\belectriques?\b/gi, 'électrique'],
  [/\bvehicules?\b/gi, 'véhicule'],
  [/\bverifi/gi, 'vérifi'],
  [/\bgeneral\b/gi, 'général'],
  [/\bsecurite\b/gi, 'sécurité'],
  [/\bprecedent/gi, 'précédent'],
  [/\bdefaut\b/gi, 'défaut'],
  [/\bdetect/gi, 'détect'],
  [/\bdegradation/gi, 'dégradation'],
  [/\bcontrole\b/gi, 'contrôle'],
  [/\bmodele\b/gi, 'modèle'],
  [/\bannee\b/gi, 'année'],
  [/\bspecifi/gi, 'spécifi'],
  [/\breferen/gi, 'référen'],
  [/\bprocedure\b/gi, 'procédure'],
  [/\bcomplete\b/gi, 'complète'],
  [/\bpieces\b/gi, 'pièces'],
  [/\bpiece\b/gi, 'pièce'],
  [/\belectri/gi, 'électri'],
  [/\benergie\b/gi, 'énergie'],
  [/\bnecessaire\b/gi, 'nécessaire'],
  [/\bpreventif\b/gi, 'préventif'],
  // --- new: automotive-specific ---
  [/\bcremaillieres?\b/gi, 'crémaillère'],
  [/\bassistees?\b/gi, 'assistée'],
  [/\bgeometrie\b/gi, 'géométrie'],
  [/\bcarrosserie\b/gi, 'carrosserie'], // correct, safety net
  [/\betancheite\b/gi, 'étanchéité'],
  [/\bdeterior/gi, 'détérior'],
  [/\bregulierement?\b/gi, 'régulièrement'],
  [/\bverifier\b/gi, 'vérifier'],
  [/\bdesserrer\b/gi, 'desserrer'], // correct, no accent
  [/\bbiellett?es?\b/gi, 'biellette'],
  [/\breveler\b/gi, 'révéler'],
  [/\bdelai\b/gi, 'délai'],
  [/\bdepose\b/gi, 'dépose'],
  [/\brepose\b/gi, 'repose'], // correct, no accent
  // --- freinage lexicon (PR fix/restoreaccents-freinage-lexicon-2026-06-02) ---
  // Frontière HYPHEN-AWARE (?<![\w-])…(?![\w-]) pour ces entrées : ne matche jamais
  // à l'intérieur d'un token kebab → protège slugs / wikilinks / URLs
  // (ex. "etrier-de-frein" intact, mais "l'etrier" corrigé). Sortie minuscule = comportement
  // historique inchangé (cf. test EnricherTextUtils "case-insensitive") — PR strictement additif.
  // Ambigus VOLONTAIREMENT exclus (laissés cassés) : cote (côté/cotation), rainure (nom/adj),
  // estime/perces (adj/verbe) — hors scope de ce correctif déterministe.
  [/(?<![\w-])cinetiques?(?![\w-])/gi, 'cinétique'],
  [/(?<![\w-])repetables?(?![\w-])/gi, 'répétable'],
  [/(?<![\w-])difficultes?(?![\w-])/gi, 'difficulté'],
  [/(?<![\w-])experiences?(?![\w-])/gi, 'expérience'],
  [/(?<![\w-])deformations?(?![\w-])/gi, 'déformation'],
  [/(?<![\w-])kilometres?(?![\w-])/gi, 'kilomètre'],
  [/(?<![\w-])capacites?(?![\w-])/gi, 'capacité'],
  [/(?<![\w-])cles?(?![\w-])/gi, 'clé'],
  [/(?<![\w-])memes?(?![\w-])/gi, 'même'],
  [/(?<![\w-])etriers?(?![\w-])/gi, 'étrier'],
  [/(?<![\w-])machoires?(?![\w-])/gi, 'mâchoire'],
  [/(?<![\w-])pedales?(?![\w-])/gi, 'pédale'],
  [/(?<![\w-])metalliques?(?![\w-])/gi, 'métallique'],
  [/(?<![\w-])allongees?(?![\w-])/gi, 'allongée'],
  [/(?<![\w-])bleutees?(?![\w-])/gi, 'bleutée'],
  [/(?<![\w-])creusees?(?![\w-])/gi, 'creusée'],
  [/(?<![\w-])immediats?(?![\w-])/gi, 'immédiat'],
  [/(?<![\w-])elevees?(?![\w-])/gi, 'élevée'],
  [/(?<![\w-])integrees?(?![\w-])/gi, 'intégrée'],
  [/(?<![\w-])diametres?(?![\w-])/gi, 'diamètre'],
  [/(?<![\w-])epaisseurs?(?![\w-])/gi, 'épaisseur'],
  [/(?<![\w-])stabilites?(?![\w-])/gi, 'stabilité'],
  [/(?<![\w-])arrieres?(?![\w-])/gi, 'arrière'],
  [/(?<![\w-])ventiles?(?![\w-])/gi, 'ventilé'],
  [/(?<![\w-])perfores?(?![\w-])/gi, 'perforé'],
  [/(?<![\w-])pressees?(?![\w-])/gi, 'pressée'],
  [/(?<![\w-])rivetees?(?![\w-])/gi, 'rivetée'],
  [/(?<![\w-])collees?(?![\w-])/gi, 'collée'],
  [/(?<![\w-])echauffements?(?![\w-])/gi, 'échauffement'],
  [/(?<![\w-])majorites?(?![\w-])/gi, 'majorité'],
  [/(?<![\w-])qualites?(?![\w-])/gi, 'qualité'],
  [/(?<![\w-])mecaniques?(?![\w-])/gi, 'mécanique'],
  [/(?<![\w-])numeros?(?![\w-])/gi, 'numéro'],
];

/**
 * Restore common French accents stripped by LLM output.
 * Idempotent: calling twice is safe.
 * Preserves plural 's' suffix automatically.
 */
export function restoreAccents(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of ACCENT_MAP) {
    result = result.replace(pattern, (match) => {
      // Preserve plural suffix
      const suffix =
        match.endsWith('s') && !replacement.endsWith('s') ? 's' : '';
      return replacement + suffix;
    });
  }
  return result;
}
