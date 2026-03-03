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
