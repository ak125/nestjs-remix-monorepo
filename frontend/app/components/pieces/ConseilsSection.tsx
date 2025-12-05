import { Badge } from '@fafa/ui';
import React, { useState, useMemo } from 'react';
import { HtmlContent } from '../seo/HtmlContent';

interface ConseilItem {
  id: number;
  title: string;
  content: string;
}

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

interface ConseilsSectionProps {
  conseils?: {
    title: string;
    content: string;
    items: ConseilItem[];
  };
  catalogueFamille?: CatalogueItem[];
  /** Nom de la gamme pour les ancres SEO enrichies */
  gammeName?: string;
}

/**
 * Ajoute des liens vers les gammes connexes dans le contenu HTML des conseils
 * Génère du HTML avec des <a> tags qui seront convertis en <Link> par HtmlContent
 */
function addGammeLinksToHtml(html: string, catalogueFamille?: CatalogueItem[]): string {
  if (!catalogueFamille || !Array.isArray(catalogueFamille) || catalogueFamille.length === 0) return html;
  
  // Dédupliquer par nom (éviter doublons de la BDD)
  const uniqueGammes = catalogueFamille.filter((gamme, index, self) => 
    index === self.findIndex(g => g.name === gamme.name)
  );
  
  let result = html;
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
          return `<a href="${gammeUrl}" class="text-green-600 hover:text-green-800 underline decoration-dotted hover:decoration-solid font-medium" title="Voir nos ${gamme.name}">${match}</a>`;
        });
        break; // Un seul lien par gamme
      }
    }
  }
  
  return result;
}

export default function ConseilsSection({ conseils, catalogueFamille, gammeName }: ConseilsSectionProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  
  // Mémoïser le traitement des liens pour les performances
  const processedConseils = useMemo(() => {
    if (!conseils?.items) return [];
    return conseils.items.map(conseil => ({
      ...conseil,
      contentWithLinks: addGammeLinksToHtml(conseil.content, catalogueFamille),
    }));
  }, [conseils?.items, catalogueFamille]);

  if (!conseils?.items || conseils.items.length === 0) {
    return null;
  }

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          💡 {conseils.title}
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            {conseils.items.length} conseils
          </span>
        </h2>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {processedConseils.map((conseil) => {
            const isExpanded = expandedItems.has(conseil.id);
            const preview = conseil.content.substring(0, 150);
            const previewWithLinks = addGammeLinksToHtml(preview, catalogueFamille);
            const needsExpansion = conseil.content.length > 150;
            
            return (
              <div
                key={conseil.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-green-300 transition-colors"
              >
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Badge variant="success">{conseil.id}</Badge>
                    {conseil.title}
                  </h3>
                  
                  <div className="text-gray-700 leading-relaxed">
                    <HtmlContent 
                      html={isExpanded ? conseil.contentWithLinks : previewWithLinks + (needsExpansion ? '...' : '')}
                      trackLinks={true}
                    />
                    
                    {needsExpansion && (
                      <button
                        onClick={() => toggleExpanded(conseil.id)}
                        className="mt-2 inline-flex items-center text-green-600 hover:text-green-700 font-medium text-sm transition-colors"
                        title={gammeName ? `Conseil complet ${gammeName} - Blog Automecanik` : 'Voir le conseil complet'}
                      >
                        {isExpanded ? (
                          <>
                            Réduire le conseil
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            Voir le conseil complet
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}