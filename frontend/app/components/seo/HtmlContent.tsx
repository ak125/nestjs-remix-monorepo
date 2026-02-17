/**
 * 🔗 HtmlContent - Composant pour rendre du HTML avec liens Remix
 *
 * Remplace dangerouslySetInnerHTML pour:
 * - Convertir les <a> internes en Remix <Link> (navigation SPA)
 * - Intégrer le tracking A/B testing des clics
 * - Conserver les liens externes en <a> standard
 *
 * Usage:
 * ```tsx
 * <HtmlContent html={article.content} className="prose" />
 * ```
 */

import { Link, useLocation } from "@remix-run/react";
import parse, {
  domToReact,
  type HTMLReactParserOptions,
  Element,
  type DOMNode,
} from "html-react-parser";
import DOMPurify from "isomorphic-dompurify";
import { memo } from "react";

import { useSeoLinkTracking } from "~/hooks/useSeoLinkTracking";

// =====================================================
// Types
// =====================================================

export interface HtmlContentProps {
  /** HTML string to render */
  html: string;
  /** Optional CSS class */
  className?: string;
  /** Enable link click tracking (default: true) */
  trackLinks?: boolean;
  /** Custom link click handler */
  onLinkClick?: (href: string, linkType: string, formula?: string) => void;
}

export interface SeoLinkData {
  href: string;
  linkType: string | null;
  formula: string | null;
  targetGamme: string | null;
  anchorText: string;
}

// =====================================================
// Helpers
// =====================================================

/**
 * Check if a URL is internal (same domain or relative)
 * SSR-safe: utilise domaine hardcodé pour éviter mismatch hydratation
 */
const SITE_ORIGIN = "https://www.automecanik.com";

function isInternalLink(href: string | undefined): boolean {
  if (!href) return false;

  // Relative URLs are internal
  if (href.startsWith("/") && !href.startsWith("//")) {
    return true;
  }

  // Check for same domain (SSR-safe: domaine hardcodé)
  try {
    const url = new URL(href, SITE_ORIGIN);
    return url.origin === SITE_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Extract text content from DOM nodes
 */
function getTextContent(nodes: DOMNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return (node as unknown as { data: string }).data;
      }
      if ("children" in node && node.children) {
        return getTextContent(node.children as DOMNode[]);
      }
      return "";
    })
    .join("");
}

/**
 * Clean HTML from Word/Microsoft junk and invalid tags
 * Fixes issues like: <spancalibri","sans-serif""> becoming valid HTML
 */
function cleanHtml(html: string): string {
  if (!html) return "";

  let cleaned = html;

  // Remove invalid Microsoft Word tags like <spancalibri...>, <spanTimes...>, etc.
  // These are malformed tags from copy-paste from Word
  cleaned = cleaned.replace(/<span[a-zA-Z][^>]*>/gi, "<span>");

  // Remove tags with quotes/special chars in name (invalid HTML)
  cleaned = cleaned.replace(/<[a-z]+["',][^>]*>/gi, "");

  // 🛡️ SSR FIX: Supprimer TOUS les attributs style inline
  // React SSR échoue si html-react-parser passe style comme string au lieu d'objet
  cleaned = cleaned.replace(/\s+style="[^"]*"/gi, "");

  // Remove Word-specific XML namespaces and tags
  cleaned = cleaned.replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<m:[^>]*>[\s\S]*?<\/m:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<!\[if[^>]*>[\s\S]*?<!\[endif\]>/gi, "");

  // Remove empty spans
  cleaned = cleaned.replace(/<span>\s*<\/span>/gi, "");

  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ");

  // Sanitize against XSS (strips scripts, event handlers, iframes, etc.)
  cleaned = DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: [
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
    ],
    ALLOWED_ATTR: [
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
    ],
  });

  return cleaned.trim();
}

// =====================================================
// Component
// =====================================================

export const HtmlContent = memo(function HtmlContent({
  html,
  className,
  trackLinks = true,
  onLinkClick,
}: HtmlContentProps) {
  const location = useLocation();
  const { trackClick } = useSeoLinkTracking();

  // Parser options to transform <a> tags
  const options: HTMLReactParserOptions = {
    replace: (domNode) => {
      // Only process Element nodes
      if (!(domNode instanceof Element)) {
        return;
      }

      // Only process <a> tags
      if (domNode.name !== "a") {
        return;
      }

      const href = domNode.attribs.href;
      const linkType = domNode.attribs["data-link-type"] || null;
      const formula = domNode.attribs["data-formula"] || null;
      const targetGamme = domNode.attribs["data-target-gamme"] || null;

      // Extract class and other attributes
      const { class: cssClass, ...otherAttribs } = domNode.attribs;
      const cleanAttribs = { ...otherAttribs };
      delete cleanAttribs.href;
      delete cleanAttribs["data-link-type"];
      delete cleanAttribs["data-formula"];
      delete cleanAttribs["data-target-gamme"];

      // Get anchor text for tracking
      const anchorText = getTextContent(domNode.children as DOMNode[]);

      // Click handler with tracking
      const handleClick = () => {
        if (trackLinks && linkType) {
          trackClick({
            linkType,
            sourceUrl: location.pathname,
            destinationUrl: href,
            anchorText,
            formula,
            targetGammeId: targetGamme ? parseInt(targetGamme, 10) : undefined,
          });
        }

        // Custom handler
        if (onLinkClick) {
          onLinkClick(href, linkType || "unknown", formula || undefined);
        }
      };

      // Internal link → Remix <Link> for SPA navigation
      if (isInternalLink(href)) {
        return (
          <Link
            to={href}
            className={cssClass}
            onClick={handleClick}
            data-link-type={linkType}
            data-formula={formula}
            data-target-gamme={targetGamme}
            prefetch="intent"
          >
            {domToReact(domNode.children as DOMNode[], options)}
          </Link>
        );
      }

      // External link → standard <a> with security attributes
      return (
        <a
          href={href}
          className={cssClass}
          onClick={handleClick}
          target="_blank"
          rel="noopener noreferrer"
          data-link-type={linkType}
          data-formula={formula}
          {...cleanAttribs}
        >
          {domToReact(domNode.children as DOMNode[], options)}
        </a>
      );
    },
  };

  // Handle empty or invalid HTML
  if (!html || typeof html !== "string") {
    return null;
  }

  // Clean HTML from Word/Microsoft junk before parsing
  const cleanedHtml = cleanHtml(html);

  return <div className={className}>{parse(cleanedHtml, options)}</div>;
});

export default HtmlContent;
