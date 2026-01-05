import { Link } from '@remix-run/react';
import React, { useState } from 'react';

interface CatalogueItem {
  name: string;
  link: string;
  image: string;
  description: string;
  meta_description: string;
}

/** 🔗 Interface pour les switches SEO (ancres variées) */
interface SeoSwitch {
  id?: string;
  sis_id?: string;
  content?: string;
  sis_content?: string;
}

interface CatalogueSectionProps {
  catalogueMameFamille?: {
    title: string;
    items: CatalogueItem[];
  };
  /** 🔗 Switches SEO pour ancres variées (verbes d'action) */
  verbSwitches?: SeoSwitch[];
}

export default function CatalogueSection({ catalogueMameFamille, verbSwitches = [] }: CatalogueSectionProps) {
  // Use array instead of Set to avoid React hydration issues
  const [expandedDescriptions, setExpandedDescriptions] = useState<number[]>([]);
  
  if (!catalogueMameFamille?.items || catalogueMameFamille.items.length === 0) {
    return null;
  }

  // 🔧 Dédupliquer les items par nom (éviter doublons de la BDD)
  const uniqueItems = catalogueMameFamille.items.filter((item, index, self) => 
    index === self.findIndex(t => t.name === item.name)
  );

  /**
   * 🔗 Génère une ancre SEO variée basée sur les switches
   * Rotation des verbes pour diversifier les ancres de liens internes
   */
  const getAnchorText = (item: CatalogueItem, index: number): string => {
    if (verbSwitches.length > 0) {
      const switchItem = verbSwitches[index % verbSwitches.length];
      const verb = switchItem?.content || switchItem?.sis_content || '';
      if (verb) {
        // Capitaliser la première lettre du verbe
        const capitalizedVerb = verb.charAt(0).toUpperCase() + verb.slice(1);
        return `${capitalizedVerb} ${item.name.toLowerCase()}`;
      }
    }
    
    // Ancres par défaut avec rotation pour variation minimale
    const defaultAnchors = [
      'Voir le produit',
      'Découvrir',
      'En savoir plus',
      'Voir les prix'
    ];
    return defaultAnchors[index % defaultAnchors.length];
  };

  const toggleDescription = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedDescriptions(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Truncate description to ~120 chars
  const truncateText = (text: string, maxLength: number = 120): string => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  };

  return (
    <section className="bg-white rounded-xl shadow-lg mb-6 md:mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-semantic-action to-semantic-action/90 p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-white flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span>📦 {catalogueMameFamille.title}</span>
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium w-fit">
            {uniqueItems.length} produits
          </span>
        </h2>
      </div>
      
      <div className="p-3 md:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {uniqueItems.map((item, index) => {
            const isExpanded = expandedDescriptions.includes(index);
            const hasDescription = item.description && item.description.length > 0;
            const displayDescription = isExpanded 
              ? item.description 
              : truncateText(item.description);
            const needsTruncation = hasDescription && item.description.length > 120;
            // 🔗 Ancre SEO variée pour maillage interne
            const anchorText = getAnchorText(item, index);
            
            return (
              <Link
                key={index}
                to={item.link}
                className="group bg-neutral-50 rounded-lg p-3 md:p-4 hover:bg-white hover:shadow-md border border-neutral-200 hover:border-semantic-action transition-all duration-200 hover:-translate-y-1"
                title={`${anchorText} - ${item.meta_description || item.name}`}
                data-seo-link="true"
                data-link-type="catalogue-famille"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="relative flex-shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        width={80}
                        height={80}
                        className="w-16 h-16 md:w-20 md:h-20 object-contain rounded group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.src = '/images/default-piece.jpg';
                        }}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm md:text-base text-neutral-900 group-hover:text-semantic-action transition-colors mb-1 line-clamp-2 leading-tight">
                        {item.name}
                      </h3>
                      
                      {/* 🔗 Ancre SEO variée au lieu de "Voir le produit" statique */}
                      <div className="flex items-center text-xs text-semantic-action font-medium group-hover:text-semantic-action/80">
                        {anchorText}
                        <svg className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Description SEO riche */}
                  {hasDescription && (
                    <div className="mt-auto pt-2 border-t border-neutral-100">
                      <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
                        {displayDescription}
                      </p>
                      {needsTruncation && (
                        <button
                          onClick={(e) => toggleDescription(index, e)}
                          className="text-xs text-semantic-action/70 hover:text-semantic-action mt-1 font-medium"
                        >
                          {isExpanded ? 'Voir moins' : 'Lire plus'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}