import React, { useState } from 'react';

interface InformationsSectionProps {
  informations?: {
    title: string;
    content: string;
    items: string[];
  };
}

export default function InformationsSection({ informations }: InformationsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Limite initiale augmentée à 10 pour plus de contenu SEO visible
  const INITIAL_DISPLAY_LIMIT = 10;

  if (!informations?.items || informations.items.length === 0) {
    return null;
  }

  const displayItems = isExpanded ? informations.items : informations.items.slice(0, INITIAL_DISPLAY_LIMIT);
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
          {displayItems.map((info, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              </div>
              <div className="flex-1 text-gray-700 leading-relaxed">
                {info}
              </div>
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