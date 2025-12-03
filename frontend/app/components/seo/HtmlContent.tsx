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

import { Link, useLocation } from '@remix-run/react';
import parse, {
  domToReact,
  HTMLReactParserOptions,
  Element,
  DOMNode,
} from 'html-react-parser';
import { useSeoLinkTracking } from '~/hooks/useSeoLinkTracking';

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
 */
function isInternalLink(href: string | undefined): boolean {
  if (!href) return false;

  // Relative URLs are internal
  if (href.startsWith('/') && !href.startsWith('//')) {
    return true;
  }

  // Check for same domain
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  // Server-side: consider relative paths as internal
  return href.startsWith('/');
}

/**
 * Extract text content from DOM nodes
 */
function getTextContent(nodes: DOMNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return (node as unknown as { data: string }).data;
      }
      if ('children' in node && node.children) {
        return getTextContent(node.children as DOMNode[]);
      }
      return '';
    })
    .join('');
}

// =====================================================
// Component
// =====================================================

export function HtmlContent({
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
      if (domNode.name !== 'a') {
        return;
      }

      const href = domNode.attribs.href;
      const linkType = domNode.attribs['data-link-type'] || null;
      const formula = domNode.attribs['data-formula'] || null;
      const targetGamme = domNode.attribs['data-target-gamme'] || null;

      // Extract class and other attributes
      const { class: cssClass, ...otherAttribs } = domNode.attribs;
      const cleanAttribs = { ...otherAttribs };
      delete cleanAttribs.href;
      delete cleanAttribs['data-link-type'];
      delete cleanAttribs['data-formula'];
      delete cleanAttribs['data-target-gamme'];

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
          onLinkClick(href, linkType || 'unknown', formula || undefined);
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
  if (!html || typeof html !== 'string') {
    return null;
  }

  return <div className={className}>{parse(html, options)}</div>;
}

export default HtmlContent;
