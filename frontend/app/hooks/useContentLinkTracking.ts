/**
 * 🔗 useContentLinkTracking Hook
 *
 * Hook pour tracker les clics sur liens dans du contenu HTML injecté
 * via dangerouslySetInnerHTML (blog, descriptions SEO, etc.)
 *
 * Utilise event delegation pour capturer les clics sans perdre les événements.
 *
 * Usage:
 * ```tsx
 * const { containerRef, formulas } = useContentLinkTracking();
 *
 * return (
 *   <div
 *     ref={containerRef}
 *     dangerouslySetInnerHTML={{ __html: content }}
 *   />
 * );
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from '@remix-run/react';

// Types pour le tracking A/B
export interface LinkFormula {
  verbId: number | null;
  nounId: number | null;
  formula: string | null;
  targetGammeId: number;
}

export interface ContentLinkTrackingOptions {
  /**
   * Callback appelé après chaque clic tracké
   */
  onLinkClick?: (url: string, formula: LinkFormula | null) => void;

  /**
   * Activer le tracking des impressions
   */
  trackImpressions?: boolean;

  /**
   * Sélecteur CSS pour identifier les liens internes SEO
   * @default 'a.seo-internal-link, a[data-link-type]'
   */
  linkSelector?: string;
}

interface UseContentLinkTrackingReturn {
  /**
   * Ref à attacher au container du contenu HTML
   */
  containerRef: React.RefObject<HTMLDivElement>;

  /**
   * Formulas des liens détectés dans le contenu
   */
  formulas: LinkFormula[];

  /**
   * Nombre de liens trackables détectés
   */
  linkCount: number;
}

// Session ID pour le tracking
function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem('seo_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('seo_session_id', sessionId);
  }
  return sessionId;
}

// Detect device type
function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';

  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua))
    return 'mobile';
  return 'desktop';
}

export function useContentLinkTracking(
  options: ContentLinkTrackingOptions = {},
): UseContentLinkTrackingReturn {
  const {
    onLinkClick,
    trackImpressions = true,
    linkSelector = 'a.seo-internal-link, a[data-link-type]',
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [formulas, setFormulas] = useState<LinkFormula[]>([]);
  const [linkCount, setLinkCount] = useState(0);
  const impressionTracked = useRef(false);

  /**
   * Parse les données d'un lien pour extraire les infos A/B testing
   */
  const parseLinkData = useCallback((link: HTMLAnchorElement): LinkFormula | null => {
    const formula = link.dataset.formula;
    const targetGamme = link.dataset.targetGamme;

    if (!targetGamme) return null;

    let verbId: number | null = null;
    let nounId: number | null = null;

    if (formula && formula.includes(':')) {
      const [v, n] = formula.split(':');
      verbId = parseInt(v, 10) || null;
      nounId = parseInt(n, 10) || null;
    }

    return {
      verbId,
      nounId,
      formula: formula || null,
      targetGammeId: parseInt(targetGamme, 10),
    };
  }, []);

  /**
   * Track un clic sur un lien interne
   */
  const trackClick = useCallback(
    async (
      linkType: string,
      destinationUrl: string,
      anchorText: string,
      formulaData: LinkFormula | null,
    ) => {
      if (typeof window === 'undefined') return;

      const sessionId = getSessionId();
      const sourceUrl = location.pathname;
      const deviceType = getDeviceType();

      try {
        // Fire and forget
        fetch('/api/seo/track-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            linkType,
            sourceUrl,
            destinationUrl,
            anchorText,
            linkPosition: 'content',
            sessionId,
            deviceType,
            // A/B Testing data
            switchVerbId: formulaData?.verbId,
            switchNounId: formulaData?.nounId,
            switchFormula: formulaData?.formula,
            targetGammeId: formulaData?.targetGammeId,
          }),
        }).catch(() => {
          // Silencieux
        });
      } catch {
        // Ne jamais bloquer la navigation
      }

      // Callback optionnel
      onLinkClick?.(destinationUrl, formulaData);
    },
    [location.pathname, onLinkClick],
  );

  /**
   * Track les impressions des liens
   */
  const trackImpressionsBatch = useCallback(
    async (links: HTMLAnchorElement[]) => {
      if (typeof window === 'undefined' || !trackImpressions) return;
      if (links.length === 0) return;

      const sessionId = getSessionId();
      const pageUrl = location.pathname;

      // Grouper par type de lien
      const byType = new Map<string, number>();
      links.forEach((link) => {
        const type = link.dataset.linkType || 'LinkGammeCar';
        byType.set(type, (byType.get(type) || 0) + 1);
      });

      // Envoyer les impressions
      try {
        await Promise.all(
          Array.from(byType.entries()).map(([linkType, count]) =>
            fetch('/api/seo/track-impression', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                linkType,
                pageUrl,
                linkCount: count,
                sessionId,
              }),
            }),
          ),
        );
      } catch {
        // Silencieux
      }
    },
    [location.pathname, trackImpressions],
  );

  /**
   * Event delegation: capture les clics sur les liens internes
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest(linkSelector) as HTMLAnchorElement | null;

      if (!link) return;

      // Extraire les données du lien
      const linkType = link.dataset.linkType || 'LinkGammeCar';
      const destinationUrl = link.getAttribute('href') || '';
      const anchorText = link.textContent || '';
      const formulaData = parseLinkData(link);

      // Track le clic
      trackClick(linkType, destinationUrl, anchorText, formulaData);

      // Ne pas empêcher la navigation
    };

    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [linkSelector, parseLinkData, trackClick]);

  /**
   * Scan initial: détecte les liens et track les impressions
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Petit délai pour laisser le DOM se stabiliser après dangerouslySetInnerHTML
    const timer = setTimeout(() => {
      const links = Array.from(
        container.querySelectorAll(linkSelector),
      ) as HTMLAnchorElement[];

      // Extraire les formulas
      const detectedFormulas = links
        .map(parseLinkData)
        .filter((f): f is LinkFormula => f !== null);

      setFormulas(detectedFormulas);
      setLinkCount(links.length);

      // Track impressions une seule fois
      if (!impressionTracked.current && links.length > 0) {
        trackImpressionsBatch(links);
        impressionTracked.current = true;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [linkSelector, parseLinkData, trackImpressionsBatch]);

  // Reset impression tracking on route change
  useEffect(() => {
    impressionTracked.current = false;
  }, [location.pathname]);

  return {
    containerRef,
    formulas,
    linkCount,
  };
}

export default useContentLinkTracking;
