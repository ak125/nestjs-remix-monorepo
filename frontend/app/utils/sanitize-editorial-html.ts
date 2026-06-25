/**
 * sanitizeEditorialHtml — sanitiseur partagé pour le HTML éditorial `sg_content`.
 *
 * Source unique de vérité pour nettoyer + sécuriser le HTML éditorial issu du
 * WIKI (`sg_content`, admin-éditable) AVANT tout rendu (`dangerouslySetInnerHTML`
 * ou `html-react-parser`). Extrait depuis `components/seo/HtmlContent.tsx` pour
 * que tous les sinks éditoriaux réutilisent la MÊME allowlist DOMPurify — pas de
 * sanitisation dupliquée, pas de sink brut non couvert.
 *
 * Deux étages :
 *  1. nettoyage des résidus Word/Microsoft + suppression des `style=` inline
 *     (html-react-parser plante côté SSR si `style` arrive en string) ;
 *  2. `DOMPurify.sanitize` avec une allowlist stricte de tags/attributs éditoriaux
 *     (strip scripts, handlers d'événements, iframes, `javascript:`…).
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

  let cleaned = html;

  // Résidus Word/Microsoft : <spancalibri…> → <span>, tags à guillemets invalides.
  cleaned = cleaned.replace(/<span[a-zA-Z][^>]*>/gi, "<span>");
  cleaned = cleaned.replace(/<[a-z]+["',][^>]*>/gi, "");

  // 🛡️ SSR : supprimer les `style=` inline (html-react-parser plante si style=string).
  cleaned = cleaned.replace(/\s+style="[^"]*"/gi, "");

  // Namespaces XML Word + conditionnels.
  cleaned = cleaned.replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<m:[^>]*>[\s\S]*?<\/m:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<!\[if[^>]*>[\s\S]*?<!\[endif\]>/gi, "");

  // Spans vides + espaces multiples.
  cleaned = cleaned.replace(/<span>\s*<\/span>/gi, "");
  cleaned = cleaned.replace(/\s+/g, " ");

  // Sanitisation XSS (strip scripts, handlers, iframes, javascript:…).
  cleaned = DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  return cleaned.trim();
}
