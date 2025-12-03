import { Link } from '@remix-run/react';
import React, { useEffect } from 'react';

/**
 * 🔗 RelatedGammesSection - Section maillage interne pour page gamme
 * 
 * Affiche des liens vers les gammes de la même famille avec ancres enrichies
 * Utilise les switches SEO pour varier les formulations (A/B testing)
 */

interface RelatedGamme {
  name: string;
  link: string;
  image?: string;
  description?: string;
}

interface RelatedGammesSectionProps {
  gammes?: RelatedGamme[];
  currentGamme: string;
  familleId?: number;
  familleName?: string;
  /** Switches SEO pour ancres variées (seo_fragments_1) */
  verbSwitches?: Array<{ sis_id: string; sis_content: string }>;
  /** Switches SEO pour noms (seo_fragments_2) */  
  nounSwitches?: Array<{ sis_id: string; sis_content: string }>;
}

export default function RelatedGammesSection({ 
  gammes,
  currentGamme,
  familleId,
  familleName = 'Freinage',
  verbSwitches = [],
  nounSwitches = []
}: RelatedGammesSectionProps) {
  
  // Ne pas afficher si pas de gammes liées
  if (!gammes || gammes.length === 0) {
    return null;
  }

  // 📊 Tracker les impressions de la section au montage
  useEffect(() => {
    // Envoyer un événement d'impression pour analytics
    if (typeof window !== 'undefined' && (window as any).trackSeoImpression) {
      (window as any).trackSeoImpression('RelatedGammesSection', {
        currentGamme,
        gammeCount: gammes.length,
        hasVerbSwitches: verbSwitches.length > 0,
        hasNounSwitches: nounSwitches.length > 0
      });
    }
  }, [currentGamme, gammes.length, verbSwitches.length, nounSwitches.length]);

  /**
   * Génère une ancre SEO enrichie avec rotation des switches
   */
  const generateAnchor = (gamme: RelatedGamme, index: number): { text: string; title: string } => {
    const gammeName = gamme.name;
    
    // Utiliser les switches si disponibles pour varier les ancres
    if (verbSwitches.length > 0) {
      // Rotation basée sur l'index pour diversité
      const verbIndex = index % verbSwitches.length;
      const verb = verbSwitches[verbIndex]?.sis_content || 'Découvrez';
      
      // Capitaliser la première lettre du verbe
      const capitalizedVerb = verb.charAt(0).toUpperCase() + verb.slice(1);
      
      return {
        text: `${capitalizedVerb} nos ${gammeName.toLowerCase()}`,
        title: `${capitalizedVerb} notre gamme de ${gammeName.toLowerCase()} à prix discount - Livraison 24/48h`
      };
    }
    
    // Ancres par défaut avec rotation
    const defaultAnchors = [
      { text: `Voir nos ${gammeName}`, title: `Découvrez notre sélection de ${gammeName} de qualité` },
      { text: `${gammeName} pas cher`, title: `${gammeName} à prix réduit - Qualité garantie` },
      { text: `Acheter ${gammeName}`, title: `Commandez vos ${gammeName} - Livraison rapide` },
      { text: `${gammeName} neufs`, title: `${gammeName} neufs d'origine - Prix discount` },
    ];
    
    return defaultAnchors[index % defaultAnchors.length];
  };

  /**
   * Track le clic sur un lien de maillage interne
   */
  const handleLinkClick = (gamme: RelatedGamme, anchorText: string) => {
    if (typeof window !== 'undefined' && (window as any).trackSeoClick) {
      (window as any).trackSeoClick('RelatedGammesSection', {
        fromGamme: currentGamme,
        toGamme: gamme.name,
        anchorText,
        linkUrl: gamme.link
      });
    }
  };

  // Limiter à 8 gammes max pour UX
  const displayGammes = gammes.slice(0, 8);

  return (
    <section className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200 p-5 md:p-6 mb-6 md:mb-8">
      <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-semantic-action" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        🔗 Voir aussi dans {familleName}
        <span className="ml-2 bg-semantic-action/10 text-semantic-action text-xs px-2 py-0.5 rounded-full font-medium">
          {displayGammes.length} produits
        </span>
      </h2>
      
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        {displayGammes.map((gamme, index) => {
          const anchor = generateAnchor(gamme, index);
          
          return (
            <li key={index}>
              <Link 
                to={gamme.link}
                className="group flex items-center gap-2 text-semantic-action hover:text-semantic-action/80 transition-colors p-2 rounded-lg hover:bg-white/60"
                onClick={() => handleLinkClick(gamme, anchor.text)}
                title={anchor.title}
                data-seo-link="true"
                data-link-type="RelatedGamme"
              >
                <span className="text-gray-400 group-hover:text-semantic-action transition-colors">→</span>
                <span className="group-hover:underline">{anchor.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      
      {/* Lien vers catalogue complet */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <Link 
          to="/pieces"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-semantic-action transition-colors"
          title="Voir notre catalogue complet de pièces auto"
        >
          <span>📦</span>
          <span className="hover:underline">Voir tout le catalogue pièces auto</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
