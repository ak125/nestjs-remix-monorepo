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

import parse, {
  domToReact,
  type HTMLReactParserOptions,
  Element,
  type DOMNode,
} from "html-react-parser";
import { memo } from "react";
import { Link, useLocation } from "react-router";

import { useSeoLinkTracking } from "~/hooks/useSeoLinkTracking";
import { sanitizeEditorialHtml } from "~/utils/sanitize-editorial-html";

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
 * Returns the site origin dynamically (lazy — no module-level side effects).
 * Client: window.location.origin (always correct)
 * Server: process.env fallback
 */
function getSiteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (
    process.env.BASE_URL ||
    process.env.API_BASE_URL ||
    "https://www.automecanik.com"
  );
}

function isInternalLink(href: string | undefined): boolean {
  if (!href) return false;

  // Relative URLs are internal
  if (href.startsWith("/") && !href.startsWith("//")) {
    return true;
  }

  // Check for same domain
  try {
    const origin = getSiteOrigin();
    const url = new URL(href, origin);
    return url.origin === origin;
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
        const to = href.startsWith("/")
          ? href
          : new URL(href, getSiteOrigin()).pathname;
        return (
          <Link
            to={to}
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

  // Clean + sanitize HTML (Word junk, XSS) via the shared editorial sanitizer.
  const cleanedHtml = sanitizeEditorialHtml(html);

  return <div className={className}>{parse(cleanedHtml, options)}</div>;
});

export default HtmlContent;
