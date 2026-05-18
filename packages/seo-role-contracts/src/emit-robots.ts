/**
 * emit-robots — single emission point pour le mapping `RobotsVerdictKind` → texte HTTP.
 *
 * **Seul module** autorisé à émettre une string `robots` / `X-Robots-Tag`
 * littérale dans le codebase (whitelist AST rule `seo-no-direct-robots-emission`).
 *
 * Symétrie meta == header par construction :
 *   - `metaContent` = valeur de `<meta name="robots" content="...">` HTML
 *   - `headerValue` = valeur de `X-Robots-Tag: ...` HTTP
 *   - Tous les deux dérivent du MÊME `verdict.kind` via le MÊME switch
 *   - V1 : `metaContent === headerValue` (cf. note plan UIDP § "split futur V2+"
 *     pour la divergence prévue quand des directives bot-specific seront ajoutées)
 *
 * @see robots-verdict.ts (RobotsVerdictKind enum)
 * @see compose-indexability.ts (producteur du verdict)
 * @see .ast-grep/rules/seo-no-direct-robots-emission.yml (anti-bypass)
 */
import {
  RobotsVerdictKind,
  type IndexabilityVerdict,
} from "./robots-verdict";

export interface RobotsEmission {
  /** Valeur du `content` de `<meta name="robots">`. */
  metaContent: string;
  /** Valeur du header HTTP `X-Robots-Tag`. */
  headerValue: string;
}

/**
 * Mappe un verdict vers les 2 représentations HTTP/HTML attendues.
 * Identité `metaContent === headerValue` garantie en V1 (cf. doctrine UIDP).
 */
export function emitRobotsForVerdict(
  verdict: IndexabilityVerdict,
): RobotsEmission {
  const text = textForKind(verdict.kind);
  return { metaContent: text, headerValue: text };
}

function textForKind(kind: RobotsVerdictKind): string {
  switch (kind) {
    case RobotsVerdictKind.INDEX_FOLLOW:
      return "index, follow";
    case RobotsVerdictKind.NOINDEX_FOLLOW:
      return "noindex, follow";
    case RobotsVerdictKind.NOINDEX_NOFOLLOW:
      return "noindex, nofollow";
  }
}
