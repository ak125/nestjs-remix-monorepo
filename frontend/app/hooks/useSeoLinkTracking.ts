/**
 * 🔗 useSeoLinkTracking Hook
 * 
 * Hook pour tracker les clics et impressions des liens internes (maillage SEO)
 * 
 * Usage:
 * ```tsx
 * const { trackClick, trackImpression } = useSeoLinkTracking();
 * 
 * // Track un clic
 * <a onClick={() => trackClick('LinkGammeCar', '/destination.html')} href="/destination.html">
 *   Lien
 * </a>
 * 
 * // Track impressions au mount
 * useEffect(() => {
 *   trackImpression('VoirAussi', 5);
 * }, []);
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from '@remix-run/react';

// Types de liens supportés
export type LinkType = 
  | 'LinkGammeCar'      // Liens vers gammes de voitures
  | 'LinkGammeCar_ID'   // Liens avec ID de gamme
  | 'CompSwitch'        // Composants compatibles
  | 'CrossSelling'      // Ventes croisées
  | 'VoirAussi'         // Section "Voir aussi"
  | 'Footer'            // Liens du footer
  | 'RelatedArticles'   // Articles liés
  | 'TopMarques'        // Top marques footer
  | 'GammesPopulaires'; // Gammes populaires footer

// Position du lien dans la page
export type LinkPosition = 
  | 'header'
  | 'content'
  | 'sidebar'
  | 'footer'
  | 'crossselling'
  | 'voiraussi';

interface TrackClickOptions {
  anchorText?: string;
  position?: LinkPosition;
}

interface UseSeoLinkTrackingReturn {
  trackClick: (linkType: LinkType, destinationUrl: string, options?: TrackClickOptions) => void;
  trackImpression: (linkType: LinkType, linkCount: number) => void;
  createTrackedLink: (linkType: LinkType, href: string, options?: TrackClickOptions) => {
    href: string;
    onClick: (e: React.MouseEvent) => void;
  };
}

// Session ID unique pour le tracking
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('seo_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('seo_session_id', sessionId);
  }
  return sessionId;
}

// Debounce pour les impressions
const impressionQueue: Map<string, { linkType: string; count: number; pageUrl: string }> = new Map();
let impressionTimeout: NodeJS.Timeout | null = null;

async function flushImpressions() {
  if (typeof window === 'undefined') return;
  
  const impressions = Array.from(impressionQueue.values());
  impressionQueue.clear();
  
  if (impressions.length === 0) return;
  
  const sessionId = getSessionId();
  
  // Envoyer les impressions groupées
  try {
    await Promise.all(
      impressions.map(({ linkType, count, pageUrl }) =>
        fetch('/api/seo/track-impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            linkType,
            pageUrl,
            linkCount: count,
            sessionId,
          }),
        })
      )
    );
  } catch (error) {
    // Silencieux en cas d'erreur - ne pas bloquer l'UX
    console.debug('[SEO Tracking] Impression tracking failed:', error);
  }
}

export function useSeoLinkTracking(): UseSeoLinkTrackingReturn {
  const location = useLocation();
  const currentUrl = useRef<string>('');
  
  // Mettre à jour l'URL courante
  useEffect(() => {
    currentUrl.current = location.pathname;
  }, [location.pathname]);
  
  /**
   * Track un clic sur un lien interne
   */
  const trackClick = useCallback(
    async (
      linkType: LinkType,
      destinationUrl: string,
      options?: TrackClickOptions
    ) => {
      if (typeof window === 'undefined') return;
      
      const sessionId = getSessionId();
      const sourceUrl = currentUrl.current || window.location.pathname;
      
      try {
        // Fire and forget - ne pas attendre la réponse
        fetch('/api/seo/track-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            linkType,
            sourceUrl,
            destinationUrl,
            anchorText: options?.anchorText,
            linkPosition: options?.position,
            sessionId,
          }),
        }).catch(() => {
          // Silencieux
        });
      } catch {
        // Ne jamais bloquer la navigation
      }
    },
    []
  );
  
  /**
   * Track une impression de liens (nombre de liens visibles)
   */
  const trackImpression = useCallback(
    (linkType: LinkType, linkCount: number) => {
      if (typeof window === 'undefined') return;
      if (linkCount <= 0) return;
      
      const pageUrl = currentUrl.current || window.location.pathname;
      const key = `${linkType}-${pageUrl}`;
      
      // Agréger les impressions du même type sur la même page
      const existing = impressionQueue.get(key);
      if (existing) {
        existing.count = Math.max(existing.count, linkCount);
      } else {
        impressionQueue.set(key, { linkType, count: linkCount, pageUrl });
      }
      
      // Debounce l'envoi
      if (impressionTimeout) {
        clearTimeout(impressionTimeout);
      }
      impressionTimeout = setTimeout(flushImpressions, 2000); // 2s après le dernier ajout
    },
    []
  );
  
  /**
   * Créer les props pour un lien tracké
   */
  const createTrackedLink = useCallback(
    (linkType: LinkType, href: string, options?: TrackClickOptions) => {
      return {
        href,
        onClick: (e: React.MouseEvent) => {
          trackClick(linkType, href, options);
          // Ne pas empêcher la navigation
        },
      };
    },
    [trackClick]
  );
  
  return {
    trackClick,
    trackImpression,
    createTrackedLink,
  };
}

export default useSeoLinkTracking;
