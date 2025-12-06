import React, { useState, useMemo } from 'react';
import { HtmlContent } from '../seo/HtmlContent';

interface CatalogueItem {
  id?: number;
  name: string;
  alias?: string;
  link?: string;
  image?: string;
  description?: string;
  meta_description?: string;
  sort?: number;
}

interface InformationsSectionProps {
  informations?: {
    title: string;
    content: string;
    items: string[];
  };
  catalogueFamille?: CatalogueItem[];
}

/**
 * Ajoute des liens vers les gammes connexes dans le texte des informations
 * Génère du HTML avec des <a> tags qui seront convertis en <Link> par HtmlContent
 */
function addGammeLinksToText(text: string, catalogueFamille?: CatalogueItem[]): string {
  if (!catalogueFamille || !Array.isArray(catalogueFamille) || catalogueFamille.length === 0) return text;
  
  // Dédupliquer par nom (éviter doublons de la BDD)
  const uniqueGammes = catalogueFamille.filter((gamme, index, self) => 
    index === self.findIndex(g => g.name === gamme.name)
  );
  
  let result = text;
  const linkedGammes = new Set<string>();
  
  for (const gamme of uniqueGammes) {
    // Vérifier que la gamme a les propriétés nécessaires (name et link ou alias+id)
    if (!gamme || !gamme.name) continue;
    
    // Construire l'URL: utiliser link si disponible, sinon construire depuis alias+id
    const gammeUrl = gamme.link || (gamme.alias && gamme.id ? `/pieces/${gamme.alias}-${gamme.id}.html` : null);
    if (!gammeUrl) continue;
    
    // Éviter les doublons de liens
    if (linkedGammes.has(gamme.name)) continue;
    
    // Créer des patterns pour le nom de la gamme (singulier et pluriel)
    const name = gamme.name.toLowerCase();
    const patterns = [
      name,
      name + 's',
      name.replace('é', 'e'),
      (name + 's').replace('é', 'e'),
    ];
    
    for (const pattern of patterns) {
      // Regex insensible à la casse, évitant les mots déjà dans des liens
      const regex = new RegExp(`(?<!<a[^>]*>)\\b(${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b(?![^<]*<\\/a>)`, 'gi');
      
      if (regex.test(result) && !linkedGammes.has(gamme.name)) {
        result = result.replace(regex, (match) => {
          linkedGammes.add(gamme.name);
          return `<a href="${gammeUrl}" class="text-indigo-600 hover:text-indigo-800 underline decoration-dotted hover:decoration-solid font-medium" title="Voir nos ${gamme.name}">${match}</a>`;
        });
        break; // Un seul lien par gamme
      }
    }
  }
  
  return result;
}

export default function InformationsSection({ informations, catalogueFamille }: InformationsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Limite initiale augmentée à 10 pour plus de contenu SEO visible
  const INITIAL_DISPLAY_LIMIT = 10;
  
  // Mémoïser le traitement des liens pour les performances
  const processedItems = useMemo(() => {
    if (!informations?.items) return [];
    return informations.items.map(item => addGammeLinksToText(item, catalogueFamille));
  }, [informations?.items, catalogueFamille]);

  if (!informations?.items || informations.items.length === 0) {
    return null;
  }

  const displayItems = isExpanded ? processedItems : processedItems.slice(0, INITIAL_DISPLAY_LIMIT);
  const hasMore = informations.items.length > INITIAL_DISPLAY_LIMIT;

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          📚 {informations.title}
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            {informations.items.length} informations
          </span>
        </h2>
      </div>
      
      <div className="p-6">
        <div className="space-y-3">
          {displayItems.map((infoHtml, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              </div>
              <HtmlContent 
                html={infoHtml}
                className="flex-1 text-gray-700 leading-relaxed"
                trackLinks={true}
              />
            </div>
          ))}
        </div>
        
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center px-6 py-3 border border-indigo-300 rounded-lg text-indigo-600 font-medium hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
            >
              {isExpanded ? (
                <>
                  Voir moins d'informations
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  Voir toutes les informations ({informations.items.length - INITIAL_DISPLAY_LIMIT} de plus)
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}