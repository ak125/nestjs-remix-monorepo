/**
 * sanitizeEditorialHtml — sanitiseur partagé pour le HTML éditorial `sg_content`.
 *
 * Source unique de vérité pour nettoyer + sécuriser le HTML éditorial issu du
 * WIKI (`sg_content`, admin-éditable) AVANT tout rendu (`dangerouslySetInnerHTML`
 * ou `html-react-parser`). Extrait depuis `components/seo/HtmlContent.tsx` pour
 * que tous les sinks éditoriaux réutilisent la MÊME allowlist DOMPurify — pas de
 * sanitisation dupliquée, pas de sink brut non couvert.
 *
 * **DOMPurify est l'unique autorité de sanitisation** (allowlist stricte de
 * tags/attributs éditoriaux). Il retire à lui seul : scripts, handlers
 * d'événements, iframes, `javascript:`, toute balise hors-allowlist (résidus
 * Word `<o:p>`/`<spancalibri>`…) et tout attribut hors-allowlist — dont `style=`
 * (→ html-react-parser SSR-safe). On NE fait AUCun strip de balise par regex :
 * la sanitisation HTML par regex est incomplète/contournable (CWE-116). Seul un
 * post-traitement cosmétique (normalisation des blancs) s'applique, sur HTML
 * déjà sûr — il ne touche jamais à la sécurité.
 *
 * Le contenu éditorial est du HTML *par conception* (`<h2>`/`<p>`/`<table>`…) :
 * on **sanitise**, on n'**échappe pas** (échapper rendrait les balises littérales).
 * Les accents français sont préservés (DOMPurify ne strip pas le texte).
 */

import DOMPurify from "isomorphic-dompurify";

/** Tags éditoriaux autorisés (structure de contenu, jamais script/style/iframe). */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "blockquote",
  "pre",
  "code",
  "hr",
  "sup",
  "sub",
  "dl",
  "dt",
  "dd",
];

/** Attributs autorisés (liens, classes, data-* de tracking, dimensions image). */
const ALLOWED_ATTR = [
  "href",
  "class",
  "id",
  "data-link-type",
  "data-formula",
  "data-target-gamme",
  "target",
  "rel",
  "src",
  "alt",
  "width",
  "height",
  "title",
  "colspan",
  "rowspan",
  "scope",
];

/**
 * Nettoie et sécurise un fragment HTML éditorial.
 *
 * @param html - HTML éditorial brut (ex. `sg_content`).
 * @returns HTML sûr (mêmes balises légitimes préservées, XSS strippé) ou `""`.
 */
export function sanitizeEditorialHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  // 🛡️ Unique autorité de sanitisation. L'allowlist retire scripts, handlers,
  // iframes, `javascript:`, les balises hors-allowlist (résidus Word `<o:p>`,
  // `<spancalibri>`…) et les attributs hors-allowlist (dont `style=` → SSR-safe).
  // Pas de strip de balise par regex (sanitisation regex = incomplète, CWE-116).
  const safe = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  // Post-traitement cosmétique sur HTML DÉJÀ sûr : normaliser les blancs (résidus
  // de copier-coller). N'altère aucune balise — sans impact sur la sécurité.
  return safe.replace(/\s+/g, " ").trim();
}
